<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\PartyIdentifier;
use Illuminate\Support\Str;

final readonly class PartyParts
{
    public function contactPoint(string $partyId, string $id): ContactPoint
    {
        return (Str::isUuid($id) ? ContactPoint::query()->where('party_id', $partyId)->find($id) : null)
            ?? throw ErrorCode::ContactPointNotFound->problem();
    }

    public function identifier(string $partyId, string $id): PartyIdentifier
    {
        return (Str::isUuid($id) ? PartyIdentifier::query()->where('party_id', $partyId)->find($id) : null)
            ?? throw ErrorCode::IdentifierNotFound->problem();
    }

    public function bankAccount(string $partyId, string $id): BankAccount
    {
        return (Str::isUuid($id) ? BankAccount::query()->where('party_id', $partyId)->find($id) : null)
            ?? throw ErrorCode::BankAccountNotFound->problem();
    }
}
