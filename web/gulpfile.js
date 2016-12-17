let gulp = require('gulp');
let ts = require('gulp-typescript');
let tsProject = ts.createProject('tsconfig.json', {
    typescript: require('typescript')
});
let merge = require('merge2');
let del = require('del');

gulp.task('tsc', function () {
    let tsResult = gulp.src('src/**/*.ts').pipe(tsProject());

    return merge([
        tsResult.js.pipe(gulp.dest('build')),
    ]);
});


gulp.task('clean', function () {
    return del(['build']);
});