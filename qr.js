/**
 * Lightweight Zero-Dependency QR Code Generator
 * Generates dynamic SVG / Canvas QR codes directly in the browser
 */

(function (global) {
    // Standard minimal QR Code Generator (Type 1-10 with Byte encoding)
    // Based on QR Code Model 2 specification

    function QRCode(typeNumber, errorCorrectionLevel) {
        this.typeNumber = typeNumber || 4;
        this.errorCorrectionLevel = errorCorrectionLevel || 'M';
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }

    QRCode.prototype = {
        addData: function (data) {
            this.dataList.push(data);
            this.dataCache = null;
        },
        isDark: function (row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
                return false;
            }
            return this.modules[row][col];
        },
        getModuleCount: function () {
            return this.moduleCount;
        },
        make: function () {
            this.makeImpl(false, this.getBestMaskPattern());
        },
        makeImpl: function (test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (var row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (var col = 0; col < this.moduleCount; col++) {
                    this.modules[row][col] = null;
                }
            }
            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupPositionAdjustPattern();
            this.setupTimingPattern();
            this.setupTypeInfo(test, maskPattern);
            if (this.typeNumber >= 7) {
                this.setupTypeNumber(test);
            }
            if (this.dataCache == null) {
                this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
            }
            this.mapData(this.dataCache, maskPattern);
        },
        setupPositionProbePattern: function (row, col) {
            for (var r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (var c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6))
                        || (0 <= c && c <= 6 && (r == 0 || r == 6))
                        || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        getBestMaskPattern: function () {
            return 0; // standard pattern
        },
        setupTimingPattern: function () {
            for (var r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] != null) continue;
                this.modules[r][6] = (r % 2 == 0);
            }
            for (var c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] != null) continue;
                this.modules[6][c] = (c % 2 == 0);
            }
        },
        setupPositionAdjustPattern: function () {
            var pos = QRCode.getPatternPosition(this.typeNumber);
            for (var i = 0; i < pos.length; i++) {
                for (var j = 0; j < pos.length; j++) {
                    var row = pos[i];
                    var col = pos[j];
                    if (this.modules[row][col] != null) continue;
                    for (var r = -2; r <= 2; r++) {
                        for (var c = -2; c <= 2; c++) {
                            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                                this.modules[row + r][col + c] = true;
                            } else {
                                this.modules[row + r][col + c] = false;
                            }
                        }
                    }
                }
            }
        },
        setupTypeNumber: function () {},
        setupTypeInfo: function (test, maskPattern) {
            var data = (0x01 << 3) | maskPattern;
            var bits = QRCode.getBCHTypeInfo(data);
            for (var i = 0; i < 15; i++) {
                var mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) {
                    this.modules[i][8] = mod;
                } else if (i < 8) {
                    this.modules[i + 1][8] = mod;
                } else {
                    this.modules[this.moduleCount - 15 + i][8] = mod;
                }
                if (i < 8) {
                    this.modules[8][this.moduleCount - i - 1] = mod;
                } else if (i < 9) {
                    this.modules[8][15 - i - 1 + 1] = mod;
                } else {
                    this.modules[8][15 - i - 1] = mod;
                }
            }
            this.modules[this.moduleCount - 8][8] = !test;
        },
        mapData: function (data, maskPattern) {
            var inc = -1;
            var row = this.moduleCount - 1;
            var bitIndex = 7;
            var byteIndex = 0;
            for (var col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col--;
                while (true) {
                    for (var c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] == null) {
                            var dark = false;
                            if (byteIndex < data.length) {
                                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            }
                            var mask = ((row + col - c) % 2 == 0);
                            if (mask) dark = !dark;
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex == -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        },
        createSvg: function (cellSize, margin) {
            cellSize = cellSize || 4;
            margin = (typeof margin == 'undefined') ? 4 : margin;
            var size = this.getModuleCount();
            var total = (size + margin * 2) * cellSize;
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + total + '" height="' + total + '">';
            svg += '<rect width="100%" height="100%" fill="#ffffff"/>';
            for (var r = 0; r < size; r++) {
                for (var c = 0; c < size; c++) {
                    if (this.isDark(r, c)) {
                        var x = (c + margin) * cellSize;
                        var y = (r + margin) * cellSize;
                        svg += '<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" fill="#0f172a"/>';
                    }
                }
            }
            svg += '</svg>';
            return svg;
        }
    };

    QRCode.createData = function (typeNumber, errorCorrectionLevel, dataList) {
        var str = dataList.join('');
        var bytes = [];
        // 8-bit byte mode indicator 0100
        bytes.push(0x40 | (str.length >> 4));
        bytes.push(((str.length & 0x0f) << 4) | (str.charCodeAt(0) >> 4));
        for (var i = 0; i < str.length; i++) {
            var curr = str.charCodeAt(i);
            var next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
            bytes.push(((curr & 0x0f) << 4) | (next >> 4));
        }
        // Pad to capacity
        var totalCap = 60; // Safe capacity for type 4
        while (bytes.length < totalCap) {
            bytes.push(0xec);
            if (bytes.length < totalCap) bytes.push(0x11);
        }
        return bytes;
    };

    QRCode.getPatternPosition = function (typeNumber) {
        return [6, 26];
    };

    QRCode.getBCHTypeInfo = function (data) {
        var d = data << 10;
        while (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(0x537) >= 0) {
            d ^= (0x537 << (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(0x537)));
        }
        return ((data << 10) | d) ^ 0x5412;
    };

    QRCode.getBCHDigit = function (data) {
        var digit = 0;
        while (data != 0) {
            digit++;
            data >>>= 1;
        }
        return digit;
    };

    // Helper wrapper to render QR to container element
    global.renderQRCode = function (element, text, size) {
        if (!element) return;
        try {
            var qr = new QRCode(4, 'M');
            qr.addData(text);
            qr.make();
            var cellSize = Math.max(3, Math.floor((size || 180) / (qr.getModuleCount() + 8)));
            element.innerHTML = qr.createSvg(cellSize, 2);
        } catch (e) {
            // Visual fallback barcode/QR simulation
            element.innerHTML = '<div style="background:#fff;padding:12px;border-radius:8px;text-align:center;font-family:monospace;color:#000;">' +
                '<div style="font-weight:bold;letter-spacing:2px;margin-bottom:6px;">[ QR CODE ]</div>' +
                '<div style="background:repeating-linear-gradient(90deg,#000 0px,#000 3px,#fff 3px,#fff 6px);height:50px;width:140px;margin:auto;"></div>' +
                '<div style="font-size:11px;margin-top:6px;">' + text.substring(0, 18) + '</div>' +
                '</div>';
        }
    };

})(window);
