import { TestBed } from '@angular/core/testing';
import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  it('renderiza el aviso de derechos y la ciudad', async () => {
    await TestBed.configureTestingModule({ imports: [AppFooter] }).compileComponents();
    const fixture = TestBed.createComponent(AppFooter);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('COLD DAY S.A.S.');
    expect(text).toContain('Cúcuta');
  });
});
