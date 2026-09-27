package com.ohmatilda.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

// POC phase 7 : foreground service exigé (targetSdk 34+) pour les sessions
// MediaProjection. Sur API < 29 le type est ignoré (simple foreground).
class ScreenCaptureService : Service() {

  companion object {
    const val ACTION_START = "com.ohmatilda.app.action.CAPTURE_START"
    const val ACTION_STOP = "com.ohmatilda.app.action.CAPTURE_STOP"
    private const val CHANNEL_ID = "ohmatilda_capture"
    private const val NOTIF_ID = 41

    fun start(ctx: Context) {
      val i = Intent(ctx, ScreenCaptureService::class.java).setAction(ACTION_START)
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
    }

    fun stop(ctx: Context) {
      ctx.startService(Intent(ctx, ScreenCaptureService::class.java).setAction(ACTION_STOP))
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        Log.i("AgentCapture", "stop service")
        stopForeground(true)
        stopSelf()
      }
      else -> startFg()
    }
    return START_NOT_STICKY
  }

  private fun startFg() {
    Log.i("AgentCapture", "start foreground service")
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Screen capture", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    val notif = builder
      .setContentTitle("Oh-Matilda")
      .setContentText("Screen capture session")
      .setSmallIcon(android.R.drawable.ic_menu_gallery)
      .build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else {
      startForeground(NOTIF_ID, notif)
    }
  }
}
