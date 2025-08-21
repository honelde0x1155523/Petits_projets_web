function random_int(min, max) {
	min = Math.floor(Number(min) || 0);
	max = Math.floor(Number(max) || 0);
	if (min > max) {
		var tmp = min;
		min = max;
		max = tmp;
	}
	var r = min + Math.floor(Math.random() * (max - min + 1));
	if (r < min) r = min;
	if (r > max) r = max;
	return r;
}
