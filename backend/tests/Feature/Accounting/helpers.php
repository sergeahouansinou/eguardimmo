<?php

declare(strict_types=1);

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Data\PostedEntryData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Money;

function comptaOrganisation(string $pays = 'FR'): Organization
{
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);

    return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', $pays), 'Awa', 'Diallo');
}

function comptaTitulaire(Organization $org): User
{
    return User::query()->findOrFail($org->created_by_user_id);
}

function comptaMembre(Organization $org, MemberRole $role): User
{
    $compte = User::factory()->create();

    app(CurrentOrganization::class)->run($org->id, fn () => OrganizationMember::query()->create([
        'user_id' => $compte->id, 'email' => mb_strtolower($compte->email), 'first_name' => 'Marc', 'last_name' => 'Chevalier',
        'role' => $role, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));

    if ($role->managesTeam()) {
        activerDeuxFacteurs($compte);
    }

    return $compte;
}

function comptaDans(Organization $org, Closure $callback): mixed
{
    return app(CurrentOrganization::class)->run($org->id, $callback);
}

/**
 * @param  array<string, string|null>  $refs
 */
function comptaLoyer(string $cle, Money $montant, string $date = '2026-11-01', array $refs = []): EntryData
{
    return new EntryData(
        Journal::Rent,
        CarbonImmutable::parse($date),
        'Loyer novembre',
        SourceType::Installment,
        $refs['item'] ?? (string) Str::uuid7(),
        $cle,
        [
            LineData::debit(AccountRole::TenantReceivable, $montant, $refs['lease'] ?? null, $refs['party'] ?? null, null, isset($refs['item']) ? ItemType::Installment : null, $refs['item'] ?? null),
            LineData::credit(AccountRole::RentRevenue, $montant, $refs['lease'] ?? null, $refs['party'] ?? null),
        ],
    );
}

/**
 * @param  array<string, string|null>  $refs
 */
function comptaPaiement(string $cle, Money $montant, string $date, array $refs = []): EntryData
{
    return new EntryData(
        Journal::Bank,
        CarbonImmutable::parse($date),
        'Encaissement',
        SourceType::Payment,
        (string) Str::uuid7(),
        $cle,
        [
            LineData::debit(AccountRole::Bank, $montant),
            LineData::credit(AccountRole::TenantReceivable, $montant, $refs['lease'] ?? null, $refs['party'] ?? null, null, isset($refs['item']) ? ItemType::Installment : null, $refs['item'] ?? null),
        ],
    );
}

function comptaPoster(Organization $org, EntryData $donnees): PostedEntryData
{
    return comptaDans($org, fn (): PostedEntryData => app(Ledger::class)->post($donnees));
}
