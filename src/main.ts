import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { AppModule } from './app/app.module';
void defineCustomElements(window);
platformBrowserDynamic().bootstrapModule(AppModule).catch(console.error);
