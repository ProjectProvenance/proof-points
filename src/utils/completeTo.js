// Complete an array (arr) to a given length (targetLength) using a given value (fill)
module.exports = function completeTo(targetLength, arr, fill) {
  let result;
  const inputLength = arr.length;
  if (inputLength >= targetLength) {
    result = arr.slice(0, targetLength);
  } else {
    result = arr;
    for (let i = 0; i < targetLength - inputLength; i += 1) {
      result.push(fill);
    }
  }
  return result;
};
