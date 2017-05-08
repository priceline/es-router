import gulp from 'gulp';
import istanbul from 'gulp-istanbul';
import jasmine from 'gulp-jasmine';
import { scriptSourceFiles, testFiles } from './gulp-config';

gulp.task('pre-test', function () {
  return gulp.src(scriptSourceFiles)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});

gulp.task('test', ['pre-test'], function () {
  return gulp.src(testFiles)
    .pipe(jasmine())
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({
      thresholds: {
        global: {
          statements: 67.55,
          branches: 60.95,
          functions: 80,
          lines: 67.83
        }
      }
    }));
});
