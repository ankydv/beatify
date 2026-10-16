package com.ankydv.beatify

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaRecorder
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.oney.WebRTCModule.WebRTCModuleOptions
import org.webrtc.audio.JavaAudioDeviceModule

class AudioRoutePackage : ReactPackage {

    companion object {
        private const val TAG = "AudioRoutePackage"
        @Volatile
        private var isWebRtcConfigured = false

        @JvmStatic
        fun initWebRtcMediaPlayout(context: Context) {
            if (isWebRtcConfigured) return
            synchronized(this) {
                if (isWebRtcConfigured) return
                try {
                    val audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()

                    val adm = JavaAudioDeviceModule.builder(context.applicationContext)
                        .setAudioAttributes(audioAttributes)
                        .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                        .setUseHardwareAcousticEchoCanceler(true)
                        .setUseHardwareNoiseSuppressor(true)
                        .setEnableVolumeLogger(false)
                        .createAudioDeviceModule()

                    WebRTCModuleOptions.getInstance().audioDeviceModule = adm
                    isWebRtcConfigured = true
                    Log.d(TAG, "WebRTC configured with USAGE_MEDIA for Full Party Mix")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to configure WebRTC with USAGE_MEDIA: ${e.message}", e)
                }
            }
        }
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        initWebRtcMediaPlayout(reactContext)
        return listOf(AudioRouteModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
