<?php

declare(strict_types=1);

namespace App\Modules\Parties;

use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyContactCategory;
use App\Modules\Parties\Models\PartyIdentifier;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class PartiesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Relation::enforceMorphMap([
            'party' => Party::class,
            'party_contact_category' => PartyContactCategory::class,
            'contact_point' => ContactPoint::class,
            'party_identifier' => PartyIdentifier::class,
            'bank_account' => BankAccount::class,
        ]);
    }
}
