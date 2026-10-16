package com.ankydv.beatify

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Robust Native Android Audio Routing Module for Beatify.
 *
 * Coordinates Android's AudioManager and ExoPlayer (TrackPlayer) so that:
 *  1. WebRTC voice communication (MODE_IN_COMMUNICATION) routes cleanly to:
 *     - 'speaker': physical loudspeaker (via setCommunicationDevice on API 31+ or isSpeakerphoneOn)
 *     - 'earpiece': top receiver earpiece
 *     - 'bluetooth_hq': high-fidelity Bluetooth A2DP stereo playback using the phone's physical mic
 *     - 'bluetooth': wireless headset / earbuds hands-free (SCO call profile)
 *  2. Music playback (ExoPlayer AudioTrack via react-native-track-player) is simultaneously
 *     directed to the same physical sink (via ExoPlayer.setPreferredAudioDevice), preventing
 *     the Android split-routing bug where music stays on Bluetooth while voice goes to speaker.
 *  3. Holds native WakeLock & WifiLock while party rooms are active so background/locked
 *     playback and Socket.io events persist without OS sleeping.
 */
class AudioRouteModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "AudioRouteModule"
    }

    private val audioManager: AudioManager by lazy {
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    private var activeRoute: String = "speaker"
    private var musicServiceInstance: Any? = null
    private var cachedExoPlayer: Any? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun getName(): String = "AudioRouteModule"

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Handler(Looper.getMainLooper()).post {
                try {
                    val binderClass = Class.forName("com.doublesymmetry.trackplayer.service.MusicService\$MusicBinder")
                    if (binderClass.isInstance(service)) {
                        val getServiceMethod = binderClass.getMethod("getService")
                        musicServiceInstance = getServiceMethod.invoke(service)
                        val exo = resolveExoPlayer()
                        if (exo != null) {
                            applyExoPlayerRoute(activeRoute)
                            Log.d(TAG, "MusicService bound and ExoPlayer retrieved via ServiceConnection")
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "ServiceConnection failed to extract player: ${e.message}")
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            musicServiceInstance = null
            cachedExoPlayer = null
        }
    }

    private fun bindMusicServiceSafely() {
        try {
            val serviceClass = Class.forName("com.doublesymmetry.trackplayer.service.MusicService")
            val intent = Intent(reactContext, serviceClass)
            reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        } catch (e: Exception) {
            Log.w(TAG, "bindMusicServiceSafely error: ${e.message}")
        }
    }

    /**
     * Safely locates the ExoPlayer instance from TrackPlayer without blocking the main thread
     * or causing infinite loops on uninitialized lateinit properties.
     */
    private fun resolveExoPlayer(): Any? {
        if (cachedExoPlayer != null) return cachedExoPlayer

        // 1. Resolve musicService from TrackPlayer's React Native module if not already set
        if (musicServiceInstance == null) {
            try {
                val musicModuleClass = try {
                    @Suppress("UNCHECKED_CAST")
                    Class.forName("com.doublesymmetry.trackplayer.module.MusicModule") as Class<out NativeModule>
                } catch (_: Exception) { null }

                if (musicModuleClass != null && reactContext.hasActiveReactInstance()) {
                    val musicModule = reactContext.getNativeModule(musicModuleClass)
                    if (musicModule != null) {
                        val field = musicModule.javaClass.getDeclaredField("musicService")
                        field.isAccessible = true
                        musicServiceInstance = field.get(musicModule)
                    }
                }
            } catch (_: Exception) {}
        }

        val ms = musicServiceInstance ?: return null

        try {
            // Check if player field exists and is initialized
            val playerField = try {
                ms.javaClass.getDeclaredField("player").apply { isAccessible = true }
            } catch (_: Exception) { null }

            val playerObj = try {
                playerField?.get(ms)
            } catch (_: Exception) { null } ?: return null

            // 1. Try public getter getExoPlayer()
            try {
                val exo = playerObj.javaClass.getMethod("getExoPlayer").invoke(playerObj)
                if (exo != null) {
                    cachedExoPlayer = exo
                    return cachedExoPlayer
                }
            } catch (_: Exception) {}

            // 2. Try declared field 'exoPlayer' on class or its superclasses (strictly bounded loop)
            var currentClass: Class<*>? = playerObj.javaClass
            for (i in 0..3) {
                if (currentClass == null) break
                try {
                    val f = currentClass.getDeclaredField("exoPlayer")
                    f.isAccessible = true
                    val exo = f.get(playerObj)
                    if (exo != null) {
                        cachedExoPlayer = exo
                        return cachedExoPlayer
                    }
                } catch (_: Exception) {}
                currentClass = currentClass.superclass
            }

            return cachedExoPlayer
        } catch (e: Exception) {
            Log.w(TAG, "resolveExoPlayer reflection error: ${e.message}")
        }
        return null
    }

    /**
     * Directs ExoPlayer's underlying AudioTrack to the specified sink device.
     * Passing null clears any preference and allows system default routing.
     * Automatically retries if ExoPlayer has not yet initialized.
     */
    private fun applyExoPlayerRoute(route: String?, retryCount: Int = 0) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        Handler(Looper.getMainLooper()).post {
            try {
                val exo = resolveExoPlayer()
                if (exo == null) {
                    if (retryCount < 8) {
                        Handler(Looper.getMainLooper()).postDelayed({
                            applyExoPlayerRoute(route, retryCount + 1)
                        }, 500)
                    }
                    return@post
                }
                val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
                val targetDevice: AudioDeviceInfo? = when (route?.lowercase()) {
                    "speaker" -> outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                    "bluetooth", "bluetooth_hq" -> outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
                        ?: outputs.firstOrNull {
                            it.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                            it.type == AudioDeviceInfo.TYPE_BLE_SPEAKER ||
                            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                        }
                    else -> null
                }
                val method = exo.javaClass.getMethod("setPreferredAudioDevice", AudioDeviceInfo::class.java)
                method.invoke(exo, targetDevice)
                Log.d(TAG, "ExoPlayer setPreferredAudioDevice applied for route: $route (type: ${targetDevice?.type})")
            } catch (e: Exception) {
                Log.w(TAG, "applyExoPlayerRoute error: ${e.message}")
            }
        }
    }

    override fun initialize() {
        super.initialize()
        AudioRoutePackage.initWebRtcMediaPlayout(reactContext)
        bindMusicServiceSafely()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                audioManager.registerAudioDeviceCallback(object : AudioDeviceCallback() {
                    override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
                        sendEvent("onAudioRoutesChanged", getRoutesMap())
                    }
                    override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
                        sendEvent("onAudioRoutesChanged", getRoutesMap())
                    }
                }, Handler(Looper.getMainLooper()))
            } catch (e: Exception) {
                Log.w(TAG, "Failed to register audio device callback: ${e.message}")
            }
        }
    }

    private fun getRoutesMap(): WritableMap {
        val result = Arguments.createMap()
        var hasBluetooth = false
        var hasHeadphones = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            for (dev in devices) {
                when (dev.type) {
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                    AudioDeviceInfo.TYPE_BLE_HEADSET,
                    AudioDeviceInfo.TYPE_BLE_SPEAKER -> hasBluetooth = true
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_USB_HEADSET -> hasHeadphones = true
                }
            }
        } else {
            @Suppress("DEPRECATION")
            hasBluetooth = audioManager.isBluetoothA2dpOn || audioManager.isBluetoothScoOn
            @Suppress("DEPRECATION")
            hasHeadphones = audioManager.isWiredHeadsetOn
        }

        result.putBoolean("speaker", true)
        result.putBoolean("earpiece", false)
        result.putBoolean("bluetooth", hasBluetooth)
        result.putBoolean("bluetooth_hq", hasBluetooth)
        result.putBoolean("headphones", hasHeadphones)
        result.putString("currentRoute", if (activeRoute == "earpiece") "speaker" else activeRoute)
        return result
    }

    @ReactMethod
    fun getAvailableRoutes(promise: Promise) {
        try {
            promise.resolve(getRoutesMap())
        } catch (e: Exception) {
            promise.reject("AUDIO_ROUTE_ERROR", e.message, e)
        }
    }

    /**
     * Set active route to 'speaker' or 'bluetooth'.
     * Directs both media playback and WebRTC voice (configured with USAGE_MEDIA in MODE_NORMAL)
     * so Android mixes them together in high-fidelity stereo.
     */
    @ReactMethod
    fun setRoute(route: String, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            try {
                val target = route.lowercase()
                Log.d(TAG, "setRoute called with target: $target")

                // Keep app in MODE_NORMAL so Android's audio mixer treats WebRTC as a standard Media stream
                audioManager.mode = AudioManager.MODE_NORMAL
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice()
                }
                try {
                    if (audioManager.isBluetoothScoOn) {
                        audioManager.stopBluetoothSco()
                        audioManager.isBluetoothScoOn = false
                    }
                } catch (_: Exception) {}

                when (target) {
                    "bluetooth", "bluetooth_hq" -> {
                        audioManager.isSpeakerphoneOn = false
                        activeRoute = "bluetooth"
                    }
                    "speaker" -> {
                        audioManager.isSpeakerphoneOn = true
                        activeRoute = "speaker"
                    }
                    else -> {
                        audioManager.isSpeakerphoneOn = true
                        activeRoute = "speaker"
                    }
                }

                // Direct media stream (TrackPlayer) to match
                applyExoPlayerRoute(activeRoute)

                promise.resolve(activeRoute)
            } catch (e: Exception) {
                Log.e(TAG, "setRoute failed", e)
                promise.reject("AUDIO_ROUTE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Resets audio settings to system normal state when leaving room.
     */
    @ReactMethod
    fun resetRoute(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice()
                }
                applyExoPlayerRoute(null)
                audioManager.isSpeakerphoneOn = false
                audioManager.mode = AudioManager.MODE_NORMAL
                try {
                    if (audioManager.isBluetoothScoOn) {
                        audioManager.stopBluetoothSco()
                        audioManager.isBluetoothScoOn = false
                    }
                } catch (_: Exception) {}

                // Release party locks if still held
                if (wakeLock?.isHeld == true) {
                    try { wakeLock?.release() } catch (_: Exception) {}
                    wakeLock = null
                }
                if (wifiLock?.isHeld == true) {
                    try { wifiLock?.release() } catch (_: Exception) {}
                    wifiLock = null
                }

                activeRoute = "speaker"
                promise.resolve("speaker")
            } catch (e: Exception) {
                promise.reject("AUDIO_ROUTE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Holds a partial wake lock and high-perf wifi lock while a party room is active,
     * preventing Android CPU sleep / wifi throttle when playback pauses or screen locks.
     */
    @ReactMethod
    fun acquirePartyLocks(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (wakeLock == null) {
                    val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
                    wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Beatify:PartyWakeLock")?.apply {
                        setReferenceCounted(false)
                    }
                }
                if (wakeLock?.isHeld != true) {
                    wakeLock?.acquire(3 * 60 * 60 * 1000L) // 3h max safety duration
                    Log.d(TAG, "Party wakeLock acquired")
                }

                if (wifiLock == null) {
                    val wifiManager = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                    val lockType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                    } else {
                        @Suppress("DEPRECATION")
                        WifiManager.WIFI_MODE_FULL_HIGH_PERF
                    }
                    wifiLock = wifiManager?.createWifiLock(lockType, "Beatify:PartyWifiLock")?.apply {
                        setReferenceCounted(false)
                    }
                }
                if (wifiLock?.isHeld != true) {
                    wifiLock?.acquire()
                    Log.d(TAG, "Party wifiLock acquired")
                }

                promise.resolve(true)
            } catch (e: Exception) {
                Log.w(TAG, "acquirePartyLocks error: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    /**
     * Releases party wake and wifi locks when leaving the party room.
     */
    @ReactMethod
    fun releasePartyLocks(promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                    Log.d(TAG, "Party wakeLock released")
                }
                wakeLock = null

                if (wifiLock?.isHeld == true) {
                    wifiLock?.release()
                    Log.d(TAG, "Party wifiLock released")
                }
                wifiLock = null

                promise.resolve(true)
            } catch (e: Exception) {
                Log.w(TAG, "releasePartyLocks error: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun getCurrentRoute(promise: Promise) {
        promise.resolve(activeRoute)
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            if (reactContext.hasActiveReactInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            }
        } catch (e: Exception) {
            Log.w(TAG, "sendEvent error: ${e.message}")
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Double) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
