import Toybox.Application;
import Toybox.Application.Storage;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

(:background)
class Route3DApp extends Application.AppBase {
    private var _view as Route3DView?;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state as Dictionary?) as Void {
    }

    function onStop(state as Dictionary?) as Void {
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        // Registrar sincronización automática en segundo plano cada 5 minutos (mínimo permitido por Garmin)
        if (Toybox.System has :ServiceDelegate) {
            Background.registerForTemporalEvent(new Time.Duration(5 * 60));
        }
        _view = new Route3DView();
        return [_view];
    }

    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new Route3DBackgroundService()];
    }

    function onBackgroundData(data as Application.PersistableType) as Void {
        if (data != null && data instanceof Dictionary) {
            Storage.setValue("liveData", data);
            if (_view != null) {
                _view.refreshFromStorage();
            }
            WatchUi.requestUpdate();
        }
    }
}
