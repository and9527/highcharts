'use strict';
import H from '../parts/Globals.js';
import '../parts/Utilities.js';

var each = H.each,
	error = H.error,
	Series = H.Series,
	isArray = H.isArray,
	addEvent = H.addEvent,
	isNumber = H.isNumber,
	seriesType = H.seriesType;

/**
 * The SMA series type.
 *
 * @constructor seriesTypes.sma
 * @augments seriesTypes.line
 */
seriesType('sma', 'line',
	/**
	 * Simple moving average indicator (SMA). This series requires `linkedTo` option to be set.
	 * 
	 * @extends {plotOptions.line}
	 * @product highstock
	 * @sample {highstock} stock/indicators/sma Simple moving average indicator
	 * @since 6.0.0
	 * @excluding
	 * 			allAreas,colorAxis,compare,compareBase,joinBy,keys,stacking,
	 * 			showInNavigator,navigatorOptions,pointInterval,pointIntervalUnit,
	 *			pointPlacement,pointRange,pointStart
	 * @optionparent plotOptions.sma
	 */
	{
		/**
		 * The series name.
		 * 
		 * @type {String}
		 * @since 6.0.0
		 * @product highstock
		 */
		name: 'SMA (14)',
		tooltip: {
			/**
			 * Number of decimals in indicator series.
			 * 
			 * @type {Number}
			 * @since 6.0.0
			 * @product highstock
			 */
			valueDecimals: 4
		},
		/**
		 * The main series ID that indicator will be based on. Required for this indicator.
		 * 
		 * @type {String}
		 * @since 6.0.0
		 * @product highstock
		 */
		linkedTo: undefined,
		params: {
			/**
			 * The point index which indicator calculations will base.
			 * For example using OHLC data, index=2 means SMA will be calculated using Low values.
			 * 
			 * @type {Number}
			 * @since 6.0.0
			 * @product highstock
			 */
			index: 0,
			/**
			 * The base period for indicator calculations.
			 * 
			 * @type {Number}
			 * @since 6.0.0
			 * @product highstock
			 */
			period: 14
		}
	}, /** @lends Highcharts.Series.prototype */ {
		bindTo: {
			series: true,
			eventName: 'updatedData'
		},
		calculateOn: 'init',
		init: function (chart, options) {
			var indicator = this;

			Series.prototype.init.call(
				indicator,
				chart,
				options
			);

			// Make sure we find series which is a base for an indicator
			chart.linkSeries();

			indicator.dataEventsToUnbind = [];

			function recalculateValues() {
				var processedData = indicator.getValues(
					indicator.linkedParent,
					indicator.options.params
				);

				indicator.xData = processedData.xData;
				indicator.yData = processedData.yData;
				indicator.options.data = processedData.values;

				//	Removal of processedXData property is required because on first translate processedXData array is empty
				if (indicator.bindTo.series === false) {
					delete indicator.processedXData;

					indicator.isDirty = true;
					indicator.redraw();
				}
				indicator.isDirtyData = false;
			}

			if (!indicator.linkedParent) {
				return error(
					'Series ' +
					indicator.options.linkedTo +
					' not found! Check `linkedTo`.'
				);
			}

			indicator.dataEventsToUnbind.push(
				addEvent(
					indicator.bindTo.series ?
						indicator.linkedParent : indicator.linkedParent.xAxis,
					indicator.bindTo.eventName,
					recalculateValues
				)
			);

			if (indicator.calculateOn === 'init') {
				recalculateValues();
			} else {
				var unbinder = addEvent(
					indicator.chart,
					indicator.calculateOn,
					function () {
						recalculateValues();
						// Call this just once, on init
						unbinder();
					}
				);
			}

			return indicator;
		},
		getValues: function (series, params) {
			var period = params.period,
				xVal = series.xData,
				yVal = series.yData,
				yValLen = yVal.length,
				range = 1,
				sum = 0,
				SMA = [],
				xData = [],
				yData = [],
				index = -1,
				i,
				SMAPoint;

			if (xVal.length <= period) {
				return false;
			}
  
			// Switch index for OHLC / Candlestick / Arearange
			if (isArray(yVal[0])) {
				index = params.index ? params.index : 0;
			}

			// Accumulate first N-points
			while (range <= period) {
				sum += index < 0 ? yVal[range] : yVal[range][index];
				range++;
			}

			// Calculate value one-by-one for each period in visible data
			for (i = period; i < yValLen; i++) {
				SMAPoint = [xVal[i], sum / period];
				SMA.push(SMAPoint);
				xData.push(SMAPoint[0]);
				yData.push(SMAPoint[1]);

				if (index < 0) {
					sum += yVal[i];
					sum -= yVal[i - period];
				} else {
					sum += yVal[i][index];
					sum -= yVal[i - period][index];
				}
			}

			return {
				values: SMA,
				xData: xData,
				yData: yData
			};
		},
		destroy: function () {
			each(this.dataEventsToUnbind, function (unbinder) {
				unbinder();
			});
			Series.prototype.destroy.call(this);
		}
	});

H.approximations = {
	sum: function (arr) {
		var len = arr.length,
			ret;

		// 1. it consists of nulls exclusively
		if (!len && arr.hasNulls) {
			ret = null;
			// 2. it has a length and real values
		} else if (len) {
			ret = 0;
			while (len--) {
				ret += arr[len];
			}
		}
		// 3. it has zero length, so just return undefined
		// => doNothing()

		return ret;
	},
	average: function (arr) {
		var len = arr.length,
			ret = H.approximations.sum(arr);

		// If we have a number, return it divided by the length. If not, return
		// null or undefined based on what the sum method finds.
		if (isNumber(ret) && len) {
			ret = ret / len;
		}

		return ret;
	},
	open: function (arr) {
		return arr.length ? arr[0] : (arr.hasNulls ? null : undefined);
	},
	high: function (arr) {
		return arr.length ? Array.max(arr) : (arr.hasNulls ? null : undefined);
	},
	low: function (arr) {
		return arr.length ? Array.min(arr) : (arr.hasNulls ? null : undefined);
	},
	close: function (arr) {
		return arr.length ? arr[arr.length - 1] : (arr.hasNulls ? null : undefined);
	},
	// ohlc and range are special cases where a multidimensional array is input and an array is output
	ohlc: function (open, high, low, close) {
		open = H.approximations.open(open);
		high = H.approximations.high(high);
		low = H.approximations.low(low);
		close = H.approximations.close(close);

		if (isNumber(open) || isNumber(high) || isNumber(low) || isNumber(close)) {
			return [open, high, low, close];
		}
		// else, return is undefined
	},
	range: function (low, high) {
		low = H.approximations.low(low);
		high = H.approximations.high(high);

		if (isNumber(low) || isNumber(high)) {
			return [low, high];
		}
		// else, return is undefined
	}
};
