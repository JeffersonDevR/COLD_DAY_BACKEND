import {bootstrapApplication} from '@angular/platform-browser';
import {addIcons} from 'ionicons';
import {
  cashOutline,
  checkmarkCircleOutline,
  constructOutline,
  cubeOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  radioOutline,
} from 'ionicons/icons';
import {MobileApp} from './app/app';
import {appConfig} from './app/app.config';

// Icons are tree-shaken: only the ones referenced by the shell are registered.
addIcons({
  cashOutline,
  checkmarkCircleOutline,
  constructOutline,
  cubeOutline,
  documentTextOutline,
  homeOutline,
  personOutline,
  radioOutline,
});

bootstrapApplication(MobileApp, appConfig).catch((err) => console.error(err));
