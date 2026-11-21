<?php

declare(strict_types=1);

namespace Tests\Feature\Charges;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Modules\Rent\Support\IssuerIdentity;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Money\Money;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Owner\OwnerContext;
use Tests\Feature\Rent\RentContext as C;

final class ChargesContext
{
    public static function preparer(object $test): void
    {
        C::preparer($test);
        config(['charges.gotenberg.url' => 'http://gotenberg.test', 'charges.gotenberg.timeout' => 10]);
    }

    /**
     * Agence : un bien, un lot sous mandat actif, un bail signé avec provision sur charges, un mandant.
     *
     * @return array{org: Organization, owner: User, unit: Unit, property: string, mandant: Party, mandate: Mandate, lease: Lease, tenantParty: Party}
     */
    public static function agence(): array
    {
        $org = C::organisation();
        ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire] = C::bail($org);
        $mandant = L::partie($org);
        $mandat = M::actif($org, $lot, $mandant);

        return ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id, 'mandant' => $mandant, 'mandate' => $mandat, 'lease' => $bail, 'tenantParty' => $locataire];
    }

    /**
     * @return array{org: Organization, owner: User, unit: Unit, property: string, lease: Lease, tenantParty: Party}
     */
    public static function autonome(): array
    {
        $org = C::organisation(OrganizationKind::Individual, 'Mme Martin');
        ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire] = C::bail($org);

        return ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id, 'lease' => $bail, 'tenantParty' => $locataire];
    }

    public static function comme(object $test, User $compte): object
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        app()->forgetInstance(IssuerIdentity::class);

        return $test->actingAs($compte);
    }

    /**
     * Navigateur de l'agence avec une preuve 2FA fraîche : la session qui la porte ne vit que pour ce compte.
     */
    public static function avecPreuve(object $test, User $compte): object
    {
        OwnerContext::navigateurAgence($test);
        self::comme($test, $compte);
        OwnerContext::preuve($test);

        return $test;
    }

    public static function membre(Organization $org, MemberRole $role, bool $deuxFacteurs = true): User
    {
        $compte = L::membre($org, $role);

        if ($deuxFacteurs) {
            activerDeuxFacteurs($compte);
        }

        return $compte;
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/charges{$chemin}";
    }

    public static function categorie(string $cle = 'maintenance'): string
    {
        return L::terme('expense_category', $cle)->id;
    }

    /**
     * @param  array<string, mixed>  $scene
     * @param  array<string, mixed>  $corps
     */
    public static function depense(object $test, array $scene, array $corps = [], ?string $cle = null, bool $avecPiece = true): TestResponse
    {
        $donnees = [
            'property_id' => $scene['property'],
            'unit_id' => $scene['unit']->id,
            'kind' => 'payment',
            'category_term_id' => self::categorie(),
            'payee_label' => 'Ascenseurs du Nord',
            'reference' => 'F-'.bin2hex(random_bytes(3)),
            'document_on' => '2026-03-10',
            'service_from' => '2026-01-01',
            'service_to' => '2027-01-01',
            'total_gross' => 24000,
            'tax_amount' => 4000,
            'recoverable_amount' => 12000,
            'recoverable_rubric' => 'elevators',
            'settlement' => isset($scene['mandant']) ? 'own_funds_advance' : 'bank',
            'paid_on' => '2026-03-12',
            ...$corps,
        ];

        if ($avecPiece && ! array_key_exists('document', $donnees)) {
            $donnees['document'] = DocumentsContext::pdf('facture.pdf');
        }

        return $test->post(self::url($scene['org'], '/expenses'), $donnees, ['Accept' => 'application/json', 'Idempotency-Key' => $cle ?? 'dep-'.bin2hex(random_bytes(6))]);
    }

    /**
     * Débit moins crédit du rôle de compte, en unités mineures.
     */
    public static function net(Organization $org, AccountRole $role): int
    {
        return (int) L::dans($org, fn () => DB::table('journal_lines')->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
            ->where('accounts.role', $role->value)->selectRaw('COALESCE(SUM(journal_lines.debit - journal_lines.credit), 0) as s')->value('s'));
    }

    public static function activerFonds(Organization $org): void
    {
        L::dans($org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    }

    public static function financer(Organization $org, Party $mandant, int $montant, AccountRole $banque = AccountRole::TrustBank): void
    {
        L::dans($org, fn () => app(Ledger::class)->post(new EntryData(
            Journal::Bank, CarbonImmutable::parse('2026-03-01'), 'Loyer encaissé', SourceType::Payment, (string) Str::uuid7(), 'fonds-'.Str::random(8),
            [LineData::debit($banque, Money::EUR($montant)), LineData::credit(AccountRole::OwnerPayable, Money::EUR($montant), null, $mandant->id)],
        )));
    }
}
