import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Acompanantes } from './acompanantes';

describe('Acompanantes', () => {
  let component: Acompanantes;
  let fixture: ComponentFixture<Acompanantes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Acompanantes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Acompanantes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
