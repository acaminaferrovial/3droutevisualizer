import Toybox.Activity;
import Toybox.Application.Storage;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

class Route3DView extends WatchUi.DataField {
    private var _liveData as Dictionary?;
    private var _lastSaveSec as Number = 0;

    function initialize() {
        DataField.initialize();
        refreshFromStorage();
    }

    function refreshFromStorage() as Void {
        var stored = Storage.getValue("liveData");
        if (stored != null && stored instanceof Dictionary) {
            _liveData = stored;
        }
    }

    // Se ejecuta cada segundo con la telemetría real del Garmin Edge 1040
    function compute(info as Activity.Info) as Void {
        var nowSec = (info.timerTime != null) ? (info.timerTime / 1000) : 0;

        // Guardar ubicación GPS, rumbo y velocidad cada 15s para el servicio en segundo plano
        if (info.currentLocation != null && (nowSec == 0 || (nowSec - _lastSaveSec) >= 15)) {
            var deg = info.currentLocation.toDegrees();
            Storage.setValue("lastLat", deg[0]);
            Storage.setValue("lastLng", deg[1]);

            var headingDeg = 0;
            if (info.currentHeading != null) {
                headingDeg = ((info.currentHeading * 180.0 / Math.PI).toNumber() + 360) % 360;
            }
            Storage.setValue("lastHeading", headingDeg);

            var speedKmh = 25;
            if (info.currentSpeed != null) {
                speedKmh = (info.currentSpeed * 3.6).toNumber();
            }
            Storage.setValue("lastSpeed", speedKmh);
            _lastSaveSec = nowSec;
        }
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var bg = getBackgroundColor();
        var isDark = (bg == Graphics.COLOR_BLACK);

        var fg = isDark ? Graphics.COLOR_WHITE : Graphics.COLOR_BLACK;
        var muted = isDark ? Graphics.COLOR_LT_GRAY : Graphics.COLOR_DK_GRAY;
        var cardBg = isDark ? 0x161920 : 0xF3F5F8;
        var accent = 0xF24E1E;

        dc.setColor(fg, bg);
        dc.clear();

        // Cabecera limpia Route3D
        dc.setColor(accent, Graphics.COLOR_TRANSPARENT);
        dc.drawText(14, 10, Graphics.FONT_SMALL, "Route3D Live", Graphics.TEXT_JUSTIFY_LEFT);

        if (_liveData == null || _liveData["ok"] != true) {
            var msg = "Esperando sincronizacion...";
            if (_liveData != null && _liveData["err"] != null) {
                msg = _liveData["err"].toString();
            }
            dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
            dc.drawText(w / 2, h / 2 - 14, Graphics.FONT_MEDIUM, msg, Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(w / 2, h / 2 + 18, Graphics.FONT_XTINY, "Conecta con Garmin Connect", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        // Hora última sincronización
        var ts = _liveData["ts"] != null ? _liveData["ts"].toString() : "--:--";
        dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w - 14, 12, Graphics.FONT_XTINY, ts, Graphics.TEXT_JUSTIFY_RIGHT);

        // BLOQUE 1: VIENTO RELATIVO + FLECHA + IMPACTO EN VATIOS
        var yWind = 46;
        var windH = 128;
        dc.setColor(cardBg, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(12, yWind, w - 24, windH, 14);

        var wMode = _liveData["wMode"] != null ? _liveData["wMode"].toString() : "LATERAL";
        var windColor = 0xEAB308; // Lateral (ámbar)
        if (wMode.equals("FAVOR")) {
            windColor = 0x16A34A; // A favor (verde)
        } else if (wMode.equals("CONTRA")) {
            windColor = 0xEF4444; // En contra (rojo)
        }

        var wRel = (_liveData["wRel"] != null) ? (_liveData["wRel"] as Number) : 0;
        drawWindArrow(dc, 62, yWind + 64, 30, wRel, windColor);

        var windSpd = _liveData["wind"] != null ? _liveData["wind"].toString() : "0";
        var gustSpd = _liveData["gust"] != null ? _liveData["gust"].toString() : "0";
        var wWatts = (_liveData["wWatts"] != null) ? (_liveData["wWatts"] as Number) : 0;
        var wattsStr = (wWatts > 0 ? "+" : "") + wWatts.toString() + " W";

        dc.setColor(windColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(114, yWind + 14, Graphics.FONT_MEDIUM, wMode, Graphics.TEXT_JUSTIFY_LEFT);

        dc.setColor(fg, Graphics.COLOR_TRANSPARENT);
        dc.drawText(114, yWind + 48, Graphics.FONT_LARGE, windSpd + " km/h", Graphics.TEXT_JUSTIFY_LEFT);

        dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
        dc.drawText(114, yWind + 92, Graphics.FONT_XTINY, "Rachas " + gustSpd + " · " + wattsStr, Graphics.TEXT_JUSTIFY_LEFT);

        // BLOQUE 2: METEO EN TU POSICIÓN (TEMP / SENSACIÓN / LLUVIA)
        var yMeteo = yWind + windH + 12;
        var meteoH = 74;
        dc.setColor(cardBg, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(12, yMeteo, w - 24, meteoH, 14);

        var tempStr = (_liveData["temp"] != null ? _liveData["temp"].toString() : "--") + "C";
        var feelStr = (_liveData["feel"] != null ? _liveData["feel"].toString() : "--") + "C";
        var rainStr = (_liveData["rain"] != null ? _liveData["rain"].toString() : "0") + "%";

        dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 4, yMeteo + 10, Graphics.FONT_XTINY, "TEMP / SENS", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText((w * 3) / 4, yMeteo + 10, Graphics.FONT_XTINY, "LLUVIA", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(fg, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 4, yMeteo + 32, Graphics.FONT_MEDIUM, tempStr + " / " + feelStr, Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText((w * 3) / 4, yMeteo + 32, Graphics.FONT_MEDIUM, rainStr, Graphics.TEXT_JUSTIFY_CENTER);

        // BLOQUE 3: FUENTE DE AGUA POTABLE MÁS CERCANA
        var yWater = yMeteo + meteoH + 12;
        var rowH = 66;
        if (yWater + rowH < h) {
            dc.setColor(cardBg, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(12, yWater, w - 24, rowH, 14);

            var water = _liveData["water"];
            dc.setColor(0x0284C7, Graphics.COLOR_TRANSPARENT);
            dc.drawText(24, yWater + 8, Graphics.FONT_XTINY, "PROXIMA FUENTE", Graphics.TEXT_JUSTIFY_LEFT);

            if (water != null && water instanceof Dictionary) {
                var wName = water["name"] != null ? water["name"].toString() : "Fuente potable";
                var wDist = water["distKm"] != null ? water["distKm"].toString() + " km" : "";
                dc.setColor(fg, Graphics.COLOR_TRANSPARENT);
                dc.drawText(24, yWater + 30, Graphics.FONT_SMALL, wName, Graphics.TEXT_JUSTIFY_LEFT);
                dc.setColor(0x0284C7, Graphics.COLOR_TRANSPARENT);
                dc.drawText(w - 24, yWater + 28, Graphics.FONT_MEDIUM, wDist, Graphics.TEXT_JUSTIFY_RIGHT);
            } else {
                dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
                dc.drawText(24, yWater + 30, Graphics.FONT_SMALL, "Sin fuentes en 3.5 km", Graphics.TEXT_JUSTIFY_LEFT);
            }
        }

        // BLOQUE 4: SEGMENTO PRIVADO MÁS CERCANO
        var ySeg = yWater + rowH + 12;
        if (ySeg + rowH <= h - 8) {
            dc.setColor(cardBg, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(12, ySeg, w - 24, rowH, 14);

            var seg = _liveData["seg"];
            dc.setColor(accent, Graphics.COLOR_TRANSPARENT);
            dc.drawText(24, ySeg + 8, Graphics.FONT_XTINY, "SEGMENTO CERCANO", Graphics.TEXT_JUSTIFY_LEFT);

            if (seg != null && seg instanceof Dictionary) {
                var sName = seg["name"] != null ? seg["name"].toString() : "Segmento";
                var sDist = seg["distKm"] != null ? seg["distKm"].toString() + " km" : "";
                var sGrade = seg["grade"] != null ? seg["grade"].toString() + "%" : "";
                dc.setColor(fg, Graphics.COLOR_TRANSPARENT);
                dc.drawText(24, ySeg + 30, Graphics.FONT_SMALL, sName, Graphics.TEXT_JUSTIFY_LEFT);
                dc.setColor(accent, Graphics.COLOR_TRANSPARENT);
                dc.drawText(w - 24, ySeg + 30, Graphics.FONT_SMALL, sDist + " · " + sGrade, Graphics.TEXT_JUSTIFY_RIGHT);
            } else {
                dc.setColor(muted, Graphics.COLOR_TRANSPARENT);
                dc.drawText(24, ySeg + 30, Graphics.FONT_SMALL, "Ningun segmento cerca", Graphics.TEXT_JUSTIFY_LEFT);
            }
        }
    }

    // Dibuja la flecha de dirección del viento rotada respecto al manillar del Edge 1040
    private function drawWindArrow(dc as Graphics.Dc, cx as Number, cy as Number, r as Number, deg as Number, color as Number) as Void {
        var rad = (deg - 90) * Math.PI / 180.0;
        var cosA = Math.cos(rad);
        var sinA = Math.sin(rad);

        var tipX = cx + (r * cosA).toNumber();
        var tipY = cy + (r * sinA).toNumber();
        var leftX = cx + ((-r * 0.65) * cosA - (r * 0.6) * sinA).toNumber();
        var leftY = cy + ((-r * 0.65) * sinA + (r * 0.6) * cosA).toNumber();
        var rightX = cx + ((-r * 0.65) * cosA + (r * 0.6) * sinA).toNumber();
        var rightY = cy + ((-r * 0.65) * sinA - (r * 0.6) * cosA).toNumber();
        var tailX = cx + ((-r * 0.3) * cosA).toNumber();
        var tailY = cy + ((-r * 0.3) * sinA).toNumber();

        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([[tipX, tipY], [leftX, leftY], [tailX, tailY], [rightX, rightY]]);
    }
}
