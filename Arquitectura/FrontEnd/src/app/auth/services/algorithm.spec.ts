import { TestBed } from '@angular/core/testing';

import { Algorithm } from './algorithm';

describe('Algorithm', () => {
  let service: Algorithm;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Algorithm);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
