import { TestBed } from '@angular/core/testing';

import { BloodPressure } from './blood-pressure';

describe('BloodPressure', () => {
  let service: BloodPressure;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BloodPressure);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
