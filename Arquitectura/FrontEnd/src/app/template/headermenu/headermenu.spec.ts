import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Headermenu } from './headermenu';

describe('Headermenu', () => {
  let component: Headermenu;
  let fixture: ComponentFixture<Headermenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Headermenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Headermenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
