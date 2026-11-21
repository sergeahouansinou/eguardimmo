<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Enums;

enum PaymentMethod: string
{
    case Transfer = 'transfer';
    case Cheque = 'cheque';
    case Cash = 'cash';
    case DirectDebit = 'direct_debit';
    case OwnerAccount = 'owner_account';

    /**
     * Moyens qu'un client peut saisir : la compensation sur le compte du mandant est réservée à la PublicApi des honoraires.
     *
     * @return list<string>
     */
    public static function manual(): array
    {
        return [self::Transfer->value, self::Cheque->value, self::Cash->value, self::DirectDebit->value];
    }
}
