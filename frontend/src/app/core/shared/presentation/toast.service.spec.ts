import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let messages: { add: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messages = { add: vi.fn(), clear: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: messages }],
    });
    service = TestBed.inject(ToastService);
  });

  it('success emite un mensaje de severidad success', () => {
    service.success('Listo', 'detalle');
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Listo', detail: 'detalle' }),
    );
  });

  it('error usa severidad error y 5s', () => {
    service.error('Falló');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', life: 5000 }));
  });

  it('info usa severidad info', () => {
    service.info('Info');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
  });

  it('warning usa severidad warn y 4.5s', () => {
    service.warning('Ojo');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', life: 4500 }));
  });

  it('show respeta la duración indicada', () => {
    service.show('SUCCESS', 't', 'm', 1234);
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ life: 1234 }));
  });

  it('clear limpia los mensajes', () => {
    service.clear();
    expect(messages.clear).toHaveBeenCalled();
  });
});
