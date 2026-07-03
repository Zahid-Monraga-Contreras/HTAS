import { TestBed } from '@angular/core/testing';

import { Htas } from './htas';

describe('Htas', () => {
  let service: Htas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Htas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
