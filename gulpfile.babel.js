import gulp from 'gulp';
import runSequence from 'run-sequence';
import buildTasks from './gulp/build';
import testTasks from './gulp/test';

gulp.task('default', function(done) {
  runSequence('clean', 'build', 'watch', done);
});
