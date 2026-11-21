<?php

declare(strict_types=1);

namespace Tests\Feature\Rent;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Modules\Rent\Actions\GenerateInstallments;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Money\Currency;
use Money\Money;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

final class RentContext
{
    public const string AUJOURDHUI = '2026-11-16 10:00:00';

    public static bool $panneGotenberg = false;

    public static function preparer(object $test): void
    {
        L::semer();
        Storage::fake('documents');
        config(['rent.gotenberg.url' => 'http://gotenberg.test']);
        self::$panneGotenberg = false;
        Http::fake(['gotenberg.test/*' => fn () => self::$panneGotenberg ? Http::response('erreur', 500) : Http::response(DocumentsContext::PDF, 200)]);
        $test->travelTo(CarbonImmutable::parse(self::AUJOURDHUI));
    }

    public static function organisation(OrganizationKind $type = OrganizationKind::Agency, string $nom = 'Agence du Port'): Organization
    {
        $titulaire = User::factory()->create();
        activerDeuxFacteurs($titulaire);

        return app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData($type, $nom, 'FR'), 'Awa', 'Diallo');
    }

    /**
     * Bail signé : un lot, un locataire, un loyer et une provision sur charges mensuels en euros (centimes).
     *
     * @param  array<string, mixed>  $attributs
     * @return array{bail: Lease, lot: Unit, locataire: Party}
     */
    public static function bail(Organization $organisation, array $attributs = [], int $loyer = 65000, int $charges = 5000): array
    {
        $bail = R::bailSigne($organisation, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'signed_on' => '2025-12-15', ...$attributs]);
        $lot = L::lot($organisation);
        $locataire = L::partie($organisation);
        $debut = $bail->starts_on->toDateString();

        R::occuper($organisation, $bail, $lot, ['valid_from' => $debut]);
        R::lier($organisation, $bail, $locataire, ['valid_from' => $debut]);
        R::terme($organisation, $bail, 'rent', ['amount' => Money::EUR($loyer), 'valid_from' => $debut]);

        if ($charges > 0) {
            R::terme($organisation, $bail, 'charges_provision', ['amount' => Money::EUR($charges), 'valid_from' => $debut, 'indexed' => false]);
        }

        return ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire];
    }

    /**
     * @return array{created: int, existing: int}
     */
    public static function generer(Organization $organisation, Lease $bail, ?string $jour = null): array
    {
        return L::dans($organisation, fn (): array => app(GenerateInstallments::class)->handle(
            app(LeaseSchedule::class)->billing($bail->id),
            CarbonImmutable::parse($jour ?? self::AUJOURDHUI)->startOfDay(),
        ));
    }

    /**
     * @return list<Installment>
     */
    public static function echeances(Organization $organisation, Lease $bail): array
    {
        return L::dans($organisation, fn (): array => array_values(Installment::query()->where('lease_id', $bail->id)->orderBy('period_start')->get()->all()));
    }

    public static function url(Organization $organisation, string $chemin = ''): string
    {
        return "/api/v1/org/{$organisation->id}/rent{$chemin}";
    }

    public static function du(Organization $organisation, Lease $bail, string $devise = 'EUR'): int
    {
        return (int) L::dans($organisation, fn () => app(LedgerReader::class)->dueByLease($bail->id, new Currency($devise))->getAmount());
    }

    /**
     * Génère puis émet l'avis de chaque échéance dont l'avis est atteint à $jour ; retourne les échéances par date.
     *
     * @return list<Installment>
     */
    public static function emises(Organization $organisation, Lease $bail, object $test, ?string $jour = null): array
    {
        $test->actingAs(L::titulaire($organisation));
        self::generer($organisation, $bail, $jour);
        $test->travelTo(CarbonImmutable::parse($jour ?? self::AUJOURDHUI));

        foreach (self::echeances($organisation, $bail) as $echeance) {
            $test->postJson(self::url($organisation, "/installments/{$echeance->id}/issue"))->assertOk();
        }

        return self::echeances($organisation, $bail);
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function payer(object $test, Organization $organisation, Lease $bail, int $montant, array $surcharges = []): TestResponse
    {
        return $test->postJson(self::url($organisation, '/payments'), [
            'lease_id' => $bail->id,
            'amount' => $montant,
            'method' => 'transfer',
            'received_on' => '2026-11-16',
            'idempotency_key' => 'cle-'.bin2hex(random_bytes(6)),
            ...$surcharges,
        ]);
    }
}
