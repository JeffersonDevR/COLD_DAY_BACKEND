import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ToastHost } from './toast-host';

describe('ToastHost', () => {
  it('se crea y renderiza el p-toast', async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHost],
      providers: [MessageService],
    }).compileComponents();
    const fixture = TestBed.createComponent(ToastHost);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('p-toast')).not.toBeNull();
  });
});
