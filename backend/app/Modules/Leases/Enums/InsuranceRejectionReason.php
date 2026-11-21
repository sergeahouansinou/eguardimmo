<?php

declare(strict_types=1);

namespace App\Modules\Leases\Enums;

enum InsuranceRejectionReason: string
{
    case Unreadable = 'unreadable';
    case WrongPerson = 'wrong_person';
    case WrongAddress = 'wrong_address';
    case Expired = 'expired';
    case MissingRentalRisks = 'missing_rental_risks';
    case Other = 'other';
}
