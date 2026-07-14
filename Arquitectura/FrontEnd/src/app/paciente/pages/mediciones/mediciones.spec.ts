import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mediciones } from './mediciones';

describe('Mediciones', () => {
  let component: Mediciones;
  let fixture: ComponentFixture<Mediciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mediciones]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mediciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
