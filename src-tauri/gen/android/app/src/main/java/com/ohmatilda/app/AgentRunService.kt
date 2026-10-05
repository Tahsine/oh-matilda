package com.ohmatilda.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.Log

// Phase 3 (spike S1, plan B) : garde le processus au premier plan pendant
// les runs agent. Sans ça, la WebView gèle après ~5-9 min en fond sur cet
// appareil : timers + fetch JS morts, cancel inopérant, run zombie
// (constaté : 9 min de silence, notif ongoing jamais mise à jour).
// Démarré/arrêté par MainActivity.agentNotify (running ↔ done/error/cancelled).
// Même canal que les notifs agent ; ID distinct (43) pour ne pas écraser
// la notif de statut (ID 42).
class AgentRunService : Service() {

  companion object {
    const val NOTIF_ID = 43
    const val CHANNEL = "ohmatilda_agent"
    // Silence JS max avant dégel : heartbeat toutes les 20 s, on tolère 3 manqués.
    const val WATCHDOG_QUIET_MS = 60000L
    const val WATCHDOG_PERIOD_MS = 20000L
  }

  private val watchHandler = Handler(Looper.getMainLooper())
  private val watchTick = object : Runnable {
    override fun run() {
      try {
        val quietFor = SystemClock.uptimeMillis() - AgentDispatcher.lastBridgeAt
        if (quietFor > WATCHDOG_QUIET_MS) {
          Log.i("AgentRunSvc", "watchdog: JS silent ${quietFor}ms — thaw (bring front)")
          val i = Intent(this@AgentRunService, MainActivity::class.java)
          i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          startActivity(i)
        }
      } catch (e: Exception) {
        Log.e("AgentRunSvc", "watchdog failed: ${e.message}")
      }
      watchHandler.postDelayed(this, WATCHDOG_PERIOD_MS)
    }
  };

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26) {
        nm.createNotificationChannel(
          NotificationChannel(CHANNEL, "Agent tasks", NotificationManager.IMPORTANCE_LOW)
        )
      }
      val open = Intent(this, MainActivity::class.java)
      open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val pi = PendingIntent.getActivity(
        this, 0, open,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(this, CHANNEL)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(this)
      }
      builder
        .setContentTitle("Oh-Matilda agent running")
        .setContentText("Keeping the agent alive")
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setOngoing(true)
        .setContentIntent(pi)
      startForeground(NOTIF_ID, builder.build())
      AgentDispatcher.noteActivity()
      watchHandler.postDelayed(watchTick, WATCHDOG_PERIOD_MS)
      Log.i("AgentRunSvc", "foreground started")
    } catch (e: Exception) {
      Log.e("AgentRunSvc", "start failed: ${e.message}")
      stopSelf()
    }
    return START_STICKY
  }

  override fun onDestroy() {
    try {
      watchHandler.removeCallbacks(watchTick)
    } catch (_: Exception) {}
    try {
      stopForeground(true)
    } catch (_: Exception) {}
    Log.i("AgentRunSvc", "stopped")
    super.onDestroy()
  }
}
