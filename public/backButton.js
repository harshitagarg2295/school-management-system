document.addEventListener("deviceready", function () {

    if (window.Capacitor && window.Capacitor.Plugins.App) {

        window.Capacitor.Plugins.App.addListener('backButton', () => {

            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.Capacitor.Plugins.App.exitApp();
            }

        });

    }

}, false);