<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Support;

final class StayRules
{
    /**
     * @return array<string, list<string>>
     */
    public static function fields(): array
    {
        return [
            'check_in' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.Calendar::today()->toDateString(), 'before:'.Calendar::today()->addYears(2)->toDateString()],
            'check_out' => ['required', 'date_format:Y-m-d', 'after:check_in'],
            'guests' => ['required', 'integer', 'min:1', 'max:50'],
        ];
    }
}
