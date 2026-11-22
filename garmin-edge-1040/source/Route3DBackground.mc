import Toybox.Application;
import Toybox.Application.Properties;
import Toybox.Application.Storage;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.System;

(:background)
class Route3DBackgroundService extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        var apiUrl = Properties.getValue("apiUrl") as String?;
        var apiKey = Properties.getValue("apiKey") as String?;

        if (apiUrl == null || apiUrl.length() < 8 || apiKey == null || apiKey.length() < 8) {
            Background.exit({ "ok" => false, "err" => "Configura URL y Clave" });
            return;
        }

        // Leer la última posición GPS y rumbo guardados por el DataField en tiempo real
        var lat = Storage.getValue("lastLat");
        var lng = Storage.getValue("lastLng");
        var heading = Storage.getValue("lastHeading");
        var speed = Storage.getValue("lastSpeed");

        if (lat == null || lng == null) {
            // Coordenadas por defecto (Azuqueca de Henares) hasta fijar satélite GPS
            lat = 40.5658;
            lng = -3.2681;
            heading = 0;
            speed = 25;
        }

        var params = {
            "lat" => lat.toString(),
            "lng" => lng.toString(),
            "heading" => (heading != null ? heading.toString() : "0"),
            "speed" => (speed != null ? speed.toString() : "25")
        };

        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => {
                "X-Garmin-Key" => apiKey,
                "Accept" => "application/json"
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };

        Communications.makeWebRequest(
            apiUrl,
            params,
            options,
            method(:onReceiveLiveResponse)
        );
    }

    function onReceiveLiveResponse(responseCode as Number, data as Dictionary or String or Null) as Void {
        if (responseCode == 200 && data != null && data instanceof Dictionary) {
            Background.exit(data);
        } else {
            Background.exit({
                "ok" => false,
                "err" => "HTTP " + responseCode.toString()
            });
        }
    }
}
