// This variable tracks whether we paint white or black
// based on the color of the first cell clicked.
let mouse_drawing = false;

$(function() {
    // Read N from the CSS variable
    const N = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--grid-size')
    );

    // Build the NxN grid
    for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
            // Create a cell
            const cell = $('<div class="cell"></div>');
            cell.data('row', row);
            cell.data('col', col);
            cell.data('isWhite', false); // initially black
            $('#grid').append(cell);
        }
    }

    // Create horizontal bars, one per row
    for (let row = 0; row < N; row++) {
        const hBar = $('<div class="horizontal-bar"></div>');
        hBar.data('row', row);
        $('#horizontalProjections').append(hBar);
    }

    // Create vertical bars, one per column
    for (let col = 0; col < N; col++) {
        const vBar = $('<div class="vertical-bar"></div>');
        vBar.data('col', col);
        $('#verticalProjections').append(vBar);
    }

    // Utility: parse a CSS pixel value to a float
    function pxVal(str) {
        return parseFloat(str.replace('px',''));
    }

    // Grab numeric sizes from the :root variables
    const cellSize = pxVal(getComputedStyle(document.documentElement)
        .getPropertyValue('--cell-size'));
    const cellGap  = pxVal(getComputedStyle(document.documentElement)
        .getPropertyValue('--cell-gap'));
    const barScaleH = pxVal(getComputedStyle(document.documentElement)
        .getPropertyValue('--bar-scale-horizontal'));
    const barScaleV = pxVal(getComputedStyle(document.documentElement)
        .getPropertyValue('--bar-scale-vertical'));

    // Track whether mouse is currently pressed
    let mouseIsDown = false;

    // Listen for mousedown/mouseup anywhere in the document
    $(document).on('mousedown', function() {
        mouseIsDown = true;
    });
    $(document).on('mouseup', function() {
        mouseIsDown = false;
    });

    // Prevent default drag behavior that can cause text selection
    $(document).on('dragstart', function(e) {
        e.preventDefault();
    });

    // Recalculate row/col counts of white squares & update bars
    function updateProjections() {
        let rowCounts = Array(N).fill(0);
        let colCounts = Array(N).fill(0);

        // Tally how many white squares in each row/col
        $('#grid .cell').each(function() {
            const isWhite = $(this).data('isWhite');
            if (isWhite) {
                const r = $(this).data('row');
                const c = $(this).data('col');
                rowCounts[r]++;
                colCounts[c]++;
            }
        });

        // Update horizontal bars
        $('#horizontalProjections .horizontal-bar').each(function() {
            const rowIdx = $(this).data('row');
            const count = rowCounts[rowIdx];
            const topOffset = rowIdx * (cellSize + cellGap);
            $(this).css({
                top: topOffset + 'px',
                width: (count * barScaleH) + 'px'
            });
        });

        // Update vertical bars (grow downward from top=2px)
        $('#verticalProjections .vertical-bar').each(function() {
            const colIdx = $(this).data('col');
            const count = colCounts[colIdx];
            const leftOffset = colIdx * (cellSize + cellGap);
            $(this).css({
                left: leftOffset + 'px',
                height: (count * barScaleV) + 'px'
            });
        });
    }

    // Helper to set a cell's color (based on mouse_drawing)
    function paintCell($cell) {
        // Paint all cells with the same color as determined at mousedown
        const nowWhite = mouse_drawing;
        $cell.data('isWhite', nowWhite);
        $cell.css('background-color', nowWhite ? 'white' : 'black');
        updateProjections();
    }

    // On mousedown, decide if we're painting white or black
    $('#grid .cell').on('mousedown', function(e) {
        e.preventDefault(); // prevent text selection

        // If the cell is currently black, we switch it (and all dragged cells) to white
        // If it's white, we switch everything to black
        mouse_drawing = !$(this).data('isWhite');

        // Paint the clicked cell immediately
        paintCell($(this));
    });

    // On mouseenter, paint if mouse is down
    $('#grid .cell').on('mouseenter', function() {
        if (mouseIsDown) {
            paintCell($(this));
        }
    });

    // Initialize bar positions (all zero) at startup
    updateProjections();
});
