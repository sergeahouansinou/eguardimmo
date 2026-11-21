<?php

declare(strict_types=1);

namespace App\Modules\Planning\Enums;

enum EventKind: string
{
    case Visit = 'visit';
    case Appointment = 'appointment';
    case Deadline = 'deadline';
    case Reminder = 'reminder';
}
