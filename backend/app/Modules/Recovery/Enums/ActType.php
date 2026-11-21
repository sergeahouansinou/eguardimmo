<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Enums;

enum ActType: string
{
    case Reminder = 'reminder';
    case FormalNotice = 'formal_notice';
    case Call = 'call';
    case Email = 'email';
    case Visit = 'visit';
    case PaymentPlan = 'payment_plan';
    case BailiffAction = 'bailiff_action';
    case Note = 'note';
    case Transmission = 'transmission';
    case Revocation = 'revocation';

    /**
     * Types qu'un gestionnaire saisit ; `transmission` et `revocation` sont écrits par le système avec l'envoi et la révocation.
     *
     * @return list<self>
     */
    public static function manual(): array
    {
        return [self::Reminder, self::FormalNotice, self::Call, self::Email, self::Visit, self::PaymentPlan, self::BailiffAction, self::Note];
    }
}
