import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitoreoPresion } from './monitoreo-presion';

describe('MonitoreoPresion', () => {
  let component: MonitoreoPresion;
  let fixture: ComponentFixture<MonitoreoPresion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonitoreoPresion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonitoreoPresion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
