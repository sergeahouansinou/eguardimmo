<?php

declare(strict_types=1);

namespace Tests\Feature\Invoicing;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Identity\Models\User;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Actions\UpdateLegalIdentity;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Data\UpdateLegalIdentityData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Enums\IdentifierScheme;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Money\Currency;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;

final class InvoicingContext
{
    public const string AUJOURDHUI = '2026-11-18 10:00:00';

    public static bool $panneGotenberg = false;

    public static function preparer(object $test): void
    {
        L::semer();
        Storage::fake('documents');
        config(['invoicing.gotenberg.url' => 'http://gotenberg.test']);
        self::$panneGotenberg = false;
        Http::fake(['gotenberg.test/*' => fn () => self::$panneGotenberg ? Http::response('erreur', 500) : Http::response(DocumentsContext::PDF, 200)]);
        $test->travelTo(CarbonImmutable::parse(self::AUJOURDHUI));
    }

    public static function organisation(OrganizationKind $type = OrganizationKind::Agency, bool $identite = true, string $nom = 'Agence du Port'): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);
        $organisation = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData($type, $nom, 'FR'), 'Awa', 'Diallo');

        if ($identite) {
            self::identite($organisation);
        }

        return $organisation;
    }

    public static function identite(Organization $organisation, VatRegime $regime = VatRegime::Normal, bool $debits = false, ?int $delai = null): void
    {
        L::dans($organisation, fn () => app(UpdateLegalIdentity::class)->handle($organisation, new UpdateLegalIdentityData(
            'Agence du Port SAS',
            ['line1' => '12 quai des Chartrons', 'line2' => null, 'postal_code' => '33000', 'city' => 'Bordeaux', 'country' => 'FR'],
            '552100554',
            '55210055400013',
            $regime === VatRegime::Normal ? 'FR40552100554' : null,
            'SAS',
            1000000,
            'Bordeaux',
            'CPI 3301 2016 000 012 345',
            'CCI de Bordeaux Gironde',
            'Galian',
            11000000,
            $regime,
            $debits,
            $delai,
        )));
    }

    public static function destinataire(Organization $organisation, ?string $courriel = 'locataire@example.test'): Party
    {
        return L::dans($organisation, function () use ($courriel): Party {
            $partie = Party::factory()->create();

            if ($courriel !== null) {
                ContactPoint::query()->create(['party_id' => $partie->id, 'type' => 'email', 'value' => $courriel, 'is_primary' => true]);
            }

            return $partie;
        });
    }

    public static function entreprise(Organization $organisation, ?string $tva = null): Party
    {
        return L::dans($organisation, function () use ($tva): Party {
            $partie = Party::factory()->company()->create(['address' => ['line1' => '5 rue des Lilas', 'postal_code' => '75011', 'city' => 'Paris', 'country' => 'FR']]);
            PartyIdentifier::query()->create(['party_id' => $partie->id, 'scheme' => IdentifierScheme::Siren, 'country' => 'FR', 'value' => '732829320']);

            if ($tva !== null) {
                PartyIdentifier::query()->create(['party_id' => $partie->id, 'scheme' => IdentifierScheme::Vat, 'country' => 'FR', 'value' => $tva]);
            }

            return $partie;
        });
    }

    public static function nature(string $cle = 'management_fee'): string
    {
        return L::terme('invoice_item', $cle)->id;
    }

    /**
     * @param  list<array<string, mixed>>|null  $lignes
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function brouillon(Party $destinataire, ?array $lignes = null, array $surcharges = []): array
    {
        return [
            'recipient_party_id' => $destinataire->id,
            'idempotency_key' => 'brouillon-'.bin2hex(random_bytes(6)),
            'lines' => $lignes ?? [self::ligne()],
            ...$surcharges,
        ];
    }

    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function ligne(int $prix = 10000, array $surcharges = []): array
    {
        return [
            'item_term_id' => self::nature(),
            'description' => 'Honoraires de gestion du trimestre',
            'quantity_milli' => 1000,
            'unit_price' => $prix,
            'tax_category' => 'S',
            'tax_rate_key' => 'fr_vat_normal',
            ...$surcharges,
        ];
    }

    /**
     * Passe au titulaire d'une autre organisation : le contexte courant est oublié.
     */
    public static function basculer(object $test, Organization $organisation): void
    {
        auth()->forgetGuards();
        app()->forgetInstance(CurrentOrganization::class);
        $test->actingAs(L::titulaire($organisation));
    }

    public static function solde(Organization $organisation, AccountRole $role): int
    {
        return (int) L::dans($organisation, fn () => app(LedgerReader::class)->accountBalance($role, new Currency('EUR'))->getAmount());
    }

    /**
     * Chaque écriture du journal doit s'équilibrer : retourne le nombre d'écritures déséquilibrées.
     */
    public static function desequilibrees(): int
    {
        return DB::table('journal_lines')->select('journal_entry_id')->groupBy('journal_entry_id')->havingRaw('SUM(debit) <> SUM(credit)')->get()->count();
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/invoices{$chemin}";
    }

    /**
     * Brouillon créé puis émis par l'API ; retourne la facture émise.
     *
     * @param  list<array<string, mixed>>|null  $lignes
     */
    public static function emettre(object $test, Organization $organisation, Party $destinataire, ?array $lignes = null): Invoice
    {
        $id = $test->postJson(self::url($organisation), self::brouillon($destinataire, $lignes))->assertCreated()->json('data.id');
        $test->postJson(self::url($organisation, "/{$id}/issue"))->assertCreated();

        return L::dans($organisation, fn (): Invoice => Invoice::query()->findOrFail($id));
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function regler(object $test, Organization $organisation, Invoice $facture, int $montant, array $surcharges = []): TestResponse
    {
        return $test->postJson(self::url($organisation, "/{$facture->id}/payments"), [
            'amount' => $montant,
            'method' => 'transfer',
            'paid_on' => '2026-11-18',
            'idempotency_key' => 'reglement-'.bin2hex(random_bytes(6)),
            ...$surcharges,
        ]);
    }

    public static function reste(Organization $organisation, Invoice $facture): int
    {
        return (int) L::dans($organisation, fn () => app(LedgerReader::class)->outstanding(ItemType::Invoice, $facture->id, new Currency('EUR'))->getAmount());
    }
}
