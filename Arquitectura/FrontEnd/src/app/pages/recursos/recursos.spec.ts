import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recursos } from './recursos';

describe('Recursos', () => {
  let component: Recursos;
  let fixture: ComponentFixture<Recursos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recursos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recursos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
