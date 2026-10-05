package com.ohmatilda.app

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

// Phase 1 (spec §5) : lecture de l'arbre → unités actionnables → rendu texte.
// Fichier dédié : le service ne fait que fournir les fenêtres + le contexte.
// Pipeline : fenêtres → nœuds bruts (copiés) → filtre → émission → rendu.
// Hypothèses S3 intégrées : profondeur réelle 15-25 (budget nœuds, pas de
// limite de profondeur), liens web = texte sans action (rôle "text" tapable
// par geste, amendement A1), conteneurs purs élagués.
object UiReader {

  const val MAX_VISITED = 2500
  const val MAX_ELEMENTS = 150
  const val MAX_LABEL = 100
  const val MAX_TEXT_LINE = 80
  const val MIN_TEXT_LINE = 3
  const val MAX_STATIC_CHARS = 1500
  const val MIN_SIZE_DP = 8

  /** Tiers vertical (relatif à la hauteur d'écran) — suffixe @top|@mid|@bot. */
  fun thirdOf(y: Float, h: Int): String {
    if (h <= 0) return "mid"
    return when {
      y < h / 3f -> "top"
      y < 2 * h / 3f -> "mid"
      else -> "bot"
    }
  }

  /** Tiers horizontal (relatif à la largeur) — suffixe @left|@center|@right. */
  fun hThirdOf(x: Float, w: Int): String {
    if (w <= 0) return "center"
    return when {
      x < w / 3f -> "left"
      x < 2 * w / 3f -> "center"
      else -> "right"
    }
  }

  /** Packages système transitoires : jamais une app "normale" au premier plan. */
  val SYS_TRANSIENT_PKGS = setOf(
    "android", "com.android.systemui",
    "com.android.packageinstaller", "com.android.permissioncontroller"
  )

  /** Nœud copié (aucune référence recyclable conservée). */
  data class Raw(
    val text: String,
    val desc: String,
    val hint: String,
    val showingHint: Boolean,
    val cls: String,
    val viewId: String?,
    val bounds: Rect,
    val clickable: Boolean,
    val editable: Boolean,
    val checkable: Boolean,
    val checked: Boolean,
    val scrollable: Boolean,
    val longClickable: Boolean,
    val enabled: Boolean,
    val focused: Boolean,
    val selected: Boolean,
    val password: Boolean,
    val visible: Boolean,
    val hasClickAction: Boolean,
    val canScrollFwd: Boolean,
    val canScrollBack: Boolean,
    val children: MutableList<Raw> = mutableListOf()
  ) {
    val actionable: Boolean
      get() = clickable || hasClickAction || editable || checkable || scrollable || longClickable
    val ownLabel: String
      get() = if (text.isNotEmpty()) text else desc
  }

  data class El(
    val id: Int,
    val role: String,
    val label: String,
    val states: List<String>,
    val scrollArrows: String,
    val indented: Boolean,
    val viewId: String?,
    val bounds: Rect,
    val actionable: Boolean,
    val hasClickAction: Boolean,
    val clickable: Boolean,
    val editable: Boolean,
    val checkable: Boolean,
    val scrollable: Boolean,
    val longClickable: Boolean,
    val password: Boolean
  )

  data class Snapshot(
    val version: Int,
    val pkg: String,
    val app: String,
    val kbd: Boolean,
    val kbdBounds: Rect,
    val dialog: Boolean,
    val truncated: Boolean,
    val sig: String,
    val text: String,
    val els: List<El>
  )

  /** Lecture complète : collecte → filtre → émission → rendu. */
  fun read(svc: AccessibilityService, version: Int): Snapshot {
    val metrics = svc.resources.displayMetrics
    val minPx = (MIN_SIZE_DP * metrics.density).toInt().coerceAtLeast(1)
    val screen = Rect(0, 0, metrics.widthPixels, metrics.heightPixels)

    var wins: List<AccessibilityWindowInfo> = emptyList()
    try {
      wins = svc.windows ?: emptyList()
    } catch (e: Exception) {
      Log.e("AgentTree", "windows failed: ${e.message}")
    }
    if (wins.isEmpty()) {
      // Repli : fenêtre active seule (config sans flagRetrieveInteractiveWindows).
      val root = try { svc.rootInActiveWindow } catch (e: Exception) {
        Log.e("AgentTree", "root failed: ${e.message}")
        null
      }
      val fgPkg = try { root?.packageName?.toString() ?: "" } catch (_: Exception) { "" }
      if (root == null) return empty(version, fgPkg)
      val raws = harvest(root, minPx, screen)
      return build(svc, version, fgPkg, raws, false, Rect(), false)
    }

    // Fenêtre IME (clavier) : présence + bounds (exclusion zone de tap A1).
    var kbd = false
    val kbdBounds = Rect()
    try {
      val dbg = StringBuilder("wins=${wins.size}")
      for (w in wins) {
        val r = try { w.root } catch (_: Exception) { null }
        val p = try { r?.packageName?.toString() ?: "?" } catch (_: Exception) { "?" }
        try { r?.recycle() } catch (_: Exception) {}
        val b = Rect()
        try { w.getBoundsInScreen(b) } catch (_: Exception) {}
        dbg.append(" [t=${w.type} pkg=$p foc=${w.isFocused} ${b.width()}x${b.height()}]")
      }
      Log.i("AgentTree", dbg.toString())
    } catch (_: Exception) {}
    // Fenêtres applicatives triées haut → bas (layer décroissant).
    val appWins = wins.filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
      .sortedByDescending { it.layer }
    for (w in wins) {
      if (w.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD) {
        val b = Rect()
        try { w.getBoundsInScreen(b) } catch (_: Exception) {}
        if (!b.isEmpty) {
          kbd = true
          kbdBounds.set(b)
        }
      }
    }
    // Shade notifications : systemui au premier plan → on le rend.
    val topPkg = try { appWins.firstOrNull()?.let { pkgOf(it) } } catch (_: Exception) { null }
    if (topPkg == "com.android.systemui" || (appWins.isEmpty() && topPkg == null)) {
      val sysWin = wins.firstOrNull { pkgOf(it) == "com.android.systemui" }
      val root = try { sysWin?.root } catch (_: Exception) { null }
      if (root != null) {
        val raws = harvest(root, minPx, screen)
        try { root.recycle() } catch (_: Exception) {}
        return build(svc, version, "com.android.systemui", raws, kbd, kbdBounds, false)
      }
    }

    // Dialog bloquante : fenêtre système/transitoire au-dessus de l'app
    // (package différent de celle du dessous : chooser, permissions), ou
    // fenêtre haute non plein-écran (dialog in-app). Sur API 26, getWindows()
    // ne renvoie souvent QUE la fenêtre du dessus : une fenêtre unique d'un
    // package système transitoire = dialog par définition. On ne rend qu'elle.
    var dialog = false
    var targetRoots = ArrayList<AccessibilityNodeInfo>()
    try {
      if (appWins.size == 1) {
        val single = appWins[0]
        val tmp = try { single.root } catch (_: Exception) { null }
        val singlePkg = try { tmp?.packageName?.toString() ?: "" } catch (_: Exception) { "" }
        try { tmp?.recycle() } catch (_: Exception) {}
        if (singlePkg in SYS_TRANSIENT_PKGS) {
          val r = try { single.root } catch (_: Exception) { null }
          if (r != null) {
            dialog = true
            targetRoots.add(r)
          }
        }
      }
      if (!dialog && appWins.size >= 2) {
        val top = appWins[0]
        val topRoot = try { top.root } catch (_: Exception) { null }
        val topPkg = try { topRoot?.packageName?.toString() ?: "" } catch (_: Exception) { "" }
        val secondPkg = pkgOf(appWins[1])
        val tb = Rect()
        try { top.getBoundsInScreen(tb) } catch (_: Exception) {}
        val isFull = tb.height() >= (screen.height() * 0.8) && tb.width() >= (screen.width() * 0.8)
        if ((topPkg.isNotEmpty() && secondPkg.isNotEmpty() && topPkg != secondPkg) ||
          (!isFull && !tb.isEmpty)) {
          if (topRoot != null) {
            dialog = true
            targetRoots.add(topRoot)
          } else {
            try { topRoot?.recycle() } catch (_: Exception) {}
          }
        } else {
          try { topRoot?.recycle() } catch (_: Exception) {}
        }
        Log.i("AgentTree", "wins=${appWins.size} top=$topPkg second=$secondPkg full=$isFull dialog=$dialog")
      }
      if (!dialog) {
        for (w in appWins) {
          if (pkgOf(w) == "com.android.systemui") continue
          val r = try { w.root } catch (_: Exception) { null }
          if (r != null) targetRoots.add(r)
        }
      }
    } catch (e: Exception) {
      Log.e("AgentTree", "roots failed: ${e.message}")
    }
    if (targetRoots.isEmpty()) {
      return empty(version, topPkg ?: "")
    }
    val pkg = topPkg ?: ""
    val raws = ArrayList<Raw>()
    var truncated = false
    for (r in targetRoots) {
      val (list, trunc) = harvestCapped(r, minPx, screen)
      raws.addAll(list)
      if (trunc) truncated = true
      try { r.recycle() } catch (_: Exception) {}
    }
    return build(svc, version, pkg, raws, kbd, kbdBounds, dialog, truncated)
  }

  private fun pkgOf(w: AccessibilityWindowInfo): String {
    return try { w.root?.packageName?.toString() ?: "" } catch (_: Exception) { "" }
  }

  private fun empty(version: Int, pkg: String): Snapshot {
    return Snapshot(version, pkg, pkg, false, Rect(), false, false, "empty", "", emptyList())
  }

  // ---------- collecte ----------

  private var visited = 0

  /** Récolte avec budget de nœuds visités (pas de limite de profondeur). */
  private fun harvestCapped(
    root: AccessibilityNodeInfo,
    minPx: Int,
    screen: Rect
  ): Pair<List<Raw>, Boolean> {
    visited = 0
    val out = ArrayList<Raw>()
    harvestInto(root, minPx, screen, out)
    return out to (visited >= MAX_VISITED)
  }

  private fun harvest(
    root: AccessibilityNodeInfo,
    minPx: Int,
    screen: Rect
  ): List<Raw> {
    visited = 0
    val out = ArrayList<Raw>()
    harvestInto(root, minPx, screen, out)
    return out
  }

  private fun harvestInto(
    n: AccessibilityNodeInfo,
    minPx: Int,
    screen: Rect,
    out: MutableList<Raw>
  ) {
    if (visited >= MAX_VISITED) return
    visited += 1
    val isPassword = try { n.isPassword } catch (_: Exception) { false }
    val text = if (isPassword) "" else (try { n.text?.toString() ?: "" } catch (_: Exception) { "" })
    val desc = try { n.contentDescription?.toString() ?: "" } catch (_: Exception) { "" }
    val b = Rect()
    try { n.getBoundsInScreen(b) } catch (_: Exception) {}
    val visible = try { n.isVisibleToUser } catch (_: Exception) { false }
    val clickable = try { n.isClickable } catch (_: Exception) { false }
    val editable = try { n.isEditable } catch (_: Exception) { false }
    val checkable = try { n.isCheckable } catch (_: Exception) { false }
    val scrollable = try { n.isScrollable } catch (_: Exception) { false }
    val longClickable = try { n.isLongClickable } catch (_: Exception) { false }
    var hasClick = false
    var fwd = false
    var back = false
    try {
      for (a in n.actionList) {
        when (a.id) {
          AccessibilityNodeInfo.AccessibilityAction.ACTION_CLICK.id -> hasClick = true
          AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD.id -> fwd = true
          AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD.id -> back = true
        }
      }
    } catch (_: Exception) {}
    // NOTE assigned once via expression form (val cannot be set in try+catch).
    val hint: String = try { n.hintText?.toString() ?: "" } catch (_: Exception) { "" }
    val showingHint: Boolean = try { n.isShowingHintText } catch (_: Exception) { false }
    // Filtre §5.2 : visible, bounds non vides ∩ écran, taille min, informatif.
    val inScreen = try { Rect.intersects(b, screen) } catch (_: Exception) { false }
    val bigEnough = b.width() >= minPx || b.height() >= minPx
    val informative = text.isNotEmpty() || desc.isNotEmpty() || hint.isNotEmpty() ||
      clickable || hasClick || editable || checkable || scrollable || longClickable || isPassword
    if (visible && !b.isEmpty && inScreen && bigEnough && informative) {
      val raw = Raw(
        text = text, desc = desc, hint = hint, showingHint = showingHint,
        cls = (try { n.className?.toString() ?: "" } catch (_: Exception) { "" }).substringAfterLast('.'),
        viewId = try { n.viewIdResourceName } catch (_: Exception) { null },
        bounds = Rect(b),
        clickable = clickable, editable = editable, checkable = checkable,
        checked = try { n.isChecked } catch (_: Exception) { false },
        scrollable = scrollable, longClickable = longClickable,
        enabled = try { n.isEnabled } catch (_: Exception) { true },
        focused = try { n.isFocused } catch (_: Exception) { false },
        selected = try { n.isSelected } catch (_: Exception) { false },
        password = isPassword, visible = visible,
        hasClickAction = hasClick, canScrollFwd = fwd, canScrollBack = back
      )
      out.add(raw)
      try {
        for (i in 0 until n.childCount) {
          if (visited >= MAX_VISITED) break
          val c = n.getChild(i) ?: continue
          harvestInto(c, minPx, screen, raw.children)
          c.recycle()
        }
      } catch (_: Exception) {}
    } else {
      // Conteneur pur sauté, enfants parcourus quand même.
      try {
        for (i in 0 until n.childCount) {
          if (visited >= MAX_VISITED) break
          val c = n.getChild(i) ?: continue
          harvestInto(c, minPx, screen, out)
          c.recycle()
        }
      } catch (_: Exception) {}
    }
  }

  // ---------- émission ----------

  private fun absorbedText(raw: Raw): String {
    // Textes des descendants non actionnables, hors sous-arbres actionnables.
    val sb = StringBuilder()
    fun walk(n: Raw) {
      for (c in n.children) {
        if (c.actionable) continue
        val lab = if (c.text.isNotEmpty()) c.text else c.desc
        if (lab.isNotEmpty()) {
          if (sb.isNotEmpty()) sb.append(" · ")
          sb.append(lab)
          if (sb.length >= MAX_LABEL) return
        }
        walk(c)
        if (sb.length >= MAX_LABEL) return
      }
    }
    walk(raw)
    return sb.toString().take(MAX_LABEL)
  }

  private fun hasActionable(n: Raw): Boolean {
    if (n.actionable) return true
    for (c in n.children) if (hasActionable(c)) return true
    return false
  }

  private fun roleOf(raw: Raw): String {
    val cls = raw.cls
    if (raw.editable || cls == "EditText") return "input"
    if (cls == "CheckBox") return "checkbox"
    if (cls == "Switch" || cls == "ToggleButton") return "switch"
    if (cls == "RadioButton") return "radio"
    if (cls.contains("Tab")) return "tab"
    if (raw.scrollable) return "list"
    if (raw.checkable) return "checkbox"
    if ((cls == "ImageView" || cls == "Image") && raw.desc.isNotEmpty()) return "image"
    if (raw.clickable || raw.hasClickAction || raw.longClickable) return "button"
    return "text"
  }

  private data class Built(val els: List<El>, val statics: List<String>)

  private fun build(
    svc: AccessibilityService,
    version: Int,
    pkg: String,
    raws: List<Raw>,
    kbd: Boolean,
    kbdBounds: Rect,
    dialog: Boolean,
    truncated: Boolean = false
  ): Snapshot {
    val els = ArrayList<El>()
    var nextId = 1

    fun emit(raw: Raw, indent: Boolean) {
      if (els.size >= MAX_ELEMENTS) return
      val role = roleOf(raw)
      val label = (if (raw.text.isNotEmpty()) raw.text else raw.desc)
        .ifEmpty { absorbedText(raw) }
        .replace('\n', ' ').trim().take(MAX_LABEL)
      val states = ArrayList<String>()
      if (!raw.enabled) states.add("disabled")
      if (raw.focused) states.add("focused")
      if (raw.selected) states.add("selected")
      if (raw.checked) states.add("checked")
      if (raw.password) states.add("password")
      if (role == "input") {
        if (raw.password) {
          // jamais de contenu password
        } else if (raw.showingHint || raw.text.isEmpty()) {
          if (raw.hint.isNotEmpty()) states.add("hint \"${raw.hint.take(40)}\"")
          else states.add("empty")
        } else {
          states.add("value \"${raw.text.take(40)}\"")
        }
      }
      var arrows = ""
      if (raw.scrollable) {
        if (raw.canScrollFwd) arrows += "↓"
        if (raw.canScrollBack) arrows += "↑"
      }
      els.add(
        El(
          id = nextId++, role = role, label = label, states = states,
          scrollArrows = arrows, indented = indent, viewId = raw.viewId,
          bounds = Rect(raw.bounds), actionable = raw.actionable,
          hasClickAction = raw.hasClickAction, clickable = raw.clickable,
          editable = raw.editable, checkable = raw.checkable,
          scrollable = raw.scrollable, longClickable = raw.longClickable,
          password = raw.password
        )
      )
      // On liste les enfants actionnables (indentés si conteneur scrollable),
      // les autres sont déjà absorbés dans le label.
      val childIndent = indent || raw.scrollable
      for (c in raw.children) {
        if (els.size >= MAX_ELEMENTS) break
        if (hasActionable(c)) emit(c, childIndent)
      }
    }

    // Texte non actionnable : collecté avec son Raw (bounds réels) pour
    // être émis AVEC id ([n] text "…", tapable par geste) jusqu'au plafond ;
    // le reliquat reste fusionné en ligne text: (contexte, sans id).
    fun collectStaticRaw(raw: Raw, out: MutableList<Raw>) {
      if (raw.actionable) {
        for (c in raw.children) collectStaticRaw(c, out)
        return
      }
      val lab = (if (raw.text.isNotEmpty()) raw.text else raw.desc)
        .replace('\n', ' ').trim().take(MAX_TEXT_LINE)
      if (lab.length >= MIN_TEXT_LINE) out.add(raw)
      for (c in raw.children) collectStaticRaw(c, out)
    }

    val staticRaws = ArrayList<Raw>()
    for (r in raws) {
      if (els.size >= MAX_ELEMENTS) break
      if (r.password) continue
      if (hasActionable(r)) emit(r, false) else collectStaticRaw(r, staticRaws)
    }
    // Émission des statics avec ids (ordre de lecture conservé).
    var staticCut = 0
    for (raw in staticRaws) {
      if (els.size >= MAX_ELEMENTS) break
      val lab = (if (raw.text.isNotEmpty()) raw.text else raw.desc)
        .replace('\n', ' ').trim().take(MAX_TEXT_LINE)
      if (lab.length < MIN_TEXT_LINE) {
        staticCut += 1
        continue
      }
      els.add(
        El(
          id = nextId++, role = "text", label = lab, states = emptyList(),
          scrollArrows = "", indented = false, viewId = null,
          bounds = Rect(raw.bounds), actionable = false,
          hasClickAction = false, clickable = false, editable = false,
          checkable = false, scrollable = false, longClickable = false,
          password = false
        )
      )
      staticCut += 1
    }

    // Doublons rôle+label → suffixe @top|@mid|@bot (lignes différentes)
    // ou @left|@center|@right (même ligne : barres d'outils, onglets).
    val seen = HashMap<String, MutableList<El>>()
    for (e in els) {
      val k = "${e.role}|${e.label}"
      seen.getOrPut(k) { mutableListOf() }.add(e)
    }
    val metrics = try { svc.resources.displayMetrics } catch (_: Exception) { null }
    val h = metrics?.heightPixels ?: 1920
    val w = metrics?.widthPixels ?: 1080
    val renamed = els.map { e ->
      val group = seen["${e.role}|${e.label}"] ?: return@map e
      if (group.size < 2 || e.label.isEmpty()) return@map e
      val thirds = group.map { thirdOf(it.bounds.exactCenterY(), h) }.toSet()
      val suffix = if (thirds.size == 1) {
        // Même ligne : départage horizontal (ordre gauche→droite stable).
        val ordered = group.sortedBy { it.bounds.exactCenterX() }
        val idx = ordered.indexOf(e)
        if (group.size == 2) {
          if (idx == 0) "left" else "right"
        } else {
          hThirdOf(e.bounds.exactCenterX(), w)
        }
      } else {
        thirdOf(e.bounds.exactCenterY(), h)
      }
      e.copy(label = "${e.label} @$suffix")
    }

    // ---------- rendu §5.4 + A1 ----------
    val sb = StringBuilder()
    val appLabel = try {
      val pm = svc.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0))?.toString() ?: pkg
    } catch (_: Exception) { pkg }
    sb.append("[v$version] app: $appLabel · keyboard: ${if (kbd) "open" else "closed"} · settled")
    if (dialog) sb.append(" · blocking: dialog")
    if (truncated) sb.append(" · truncated")
    sb.append('\n')
    for (e in renamed) {
      val line = StringBuilder()
      if (e.indented) line.append("  ")
      line.append("[${e.id}] ${e.role}")
      if (e.label.isNotEmpty()) line.append(" \"${e.label}\"")
      for (s in e.states) line.append(" $s")
      if (e.scrollArrows.isNotEmpty()) line.append(" ${e.scrollArrows}")
      sb.append(line).append('\n')
    }
    // Reliquat au-delà du plafond : ligne text: fusionnée (contexte, sans id).
    var staticUsed = 0
    var staticShown = 0
    var staticTotal = 0
    val staticSb = StringBuilder()
    for (raw in staticRaws.drop(staticCut)) {
      val s = (if (raw.text.isNotEmpty()) raw.text else raw.desc)
        .replace('\n', ' ').trim().take(MAX_TEXT_LINE)
      if (s.length < MIN_TEXT_LINE) continue
      staticTotal += 1
      if (staticUsed + s.length + 3 > MAX_STATIC_CHARS) continue
      if (staticShown > 0) staticSb.append(" · ")
      staticSb.append(s)
      staticUsed += s.length + 3
      staticShown += 1
    }
    if (staticShown > 0) {
      sb.append("text: $staticSb\n")
    }
    if (els.size >= MAX_ELEMENTS || staticTotal > staticShown) {
      sb.append("… +more (scroll)\n")
    }

    // ---------- signature §5.5 (sans bounds, sans systemui) ----------
    val sigSb = StringBuilder()
    for (e in renamed) {
      sigSb.append(e.role).append('|').append(e.label).append('|')
      for (s in e.states) sigSb.append(s).append(',')
      sigSb.append(';')
    }
    sigSb.append('#').append(staticSb.toString())

    return Snapshot(
      version = version, pkg = pkg, app = appLabel, kbd = kbd,
      kbdBounds = Rect(kbdBounds), dialog = dialog, truncated = truncated,
      sig = sigSb.toString().hashCode().toString(16),
      text = sb.toString(), els = renamed
    )
  }
}
