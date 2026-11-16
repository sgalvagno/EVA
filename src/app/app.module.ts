import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AppComponent } from './app.component';
import { HomePage } from './home/home.page';

@NgModule({
  declarations: [AppComponent, HomePage],
  imports: [BrowserModule, FormsModule, IonicModule.forRoot()],
  bootstrap: [AppComponent]
})
export class AppModule {}
