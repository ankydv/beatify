package com.ankydv.beatify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground Service dedicated to Beatify Party Voice & Audio streaming.
 *
 * Android 9+ (and strictly on Android 14+) blocks/silences microphone capture (AudioRecord)
 * whenever an app is in the background or the screen is locked UNLESS an active Foreground Service
 * with foregroundServiceType="microphone" is running.
 *
 * This service ensures:
 * 1. WebRTC microphone capture continues cleanly without being muted by Android when screen is locked or app is minimized.
 * 2. Process priority is maintained at FOREGROUND_SERVICE level, preventing Android Doze mode / App Standby
 *    from throttling Socket.io and WebRTC UDP/STUN/ICE network packets.
 * 3. Keeps a PARTIAL_WAKE_LOCK so CPU doesn't sleep while voice communication is active.
 */
class PartyVoiceService : Service() {

    companion object {
        const val TAG = "PartyVoiceService"
        const val CHANNEL_ID = "beatify_party_voice_channel"
        const val NOTIFICATION_ID = 90210
        const val ACTION_START = "com.ankydv.beatify.START_PARTY_VOICE"
        const val ACTION_STOP = "com.ankydv.beatify.STOP_PARTY_VOICE"

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundService()
            return START_NOT_STICKY
        }

        startForegroundWithNotification()
        acquireServiceWakeLock()
        isRunning = true
        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = if (launchIntent != null) {
                PendingIntent.getActivity(this, 0, launchIntent, pendingIntentFlags)
            } else null

            val iconRes = applicationInfo.icon.takeIf { it != 0 }
                ?: android.R.drawable.ic_btn_speak_now

            val builder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("In Party / Jam")
                .setContentText("Click to open")
                .setSmallIcon(iconRes)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

            if (pendingIntent != null) {
                builder.setContentIntent(pendingIntent)
            }

            val notification = builder.build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            Log.d(TAG, "PartyVoiceService started as foreground service (microphone)")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}", e)
        }
    }

    private fun acquireServiceWakeLock() {
        try {
            if (wakeLock == null) {
                val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Beatify:PartyVoiceWakeLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (wakeLock?.isHeld != true) {
                wakeLock?.acquire(4 * 60 * 60 * 1000L) // 4h safety max
                Log.d(TAG, "PartyVoiceService wakeLock acquired")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to acquire service wakeLock: ${e.message}")
        }
    }

    private fun stopForegroundService() {
        isRunning = false
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "PartyVoiceService wakeLock released")
            }
            wakeLock = null
        } catch (_: Exception) {}

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (_: Exception) {}

        stopSelf()
        Log.d(TAG, "PartyVoiceService stopped")
    }

    override fun onDestroy() {
        stopForegroundService()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Party Voice & Audio",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notification displayed while in a party voice room"
                setShowBadge(false)
            }
            manager?.createNotificationChannel(channel)
        }
    }
}
