<?php

declare(strict_types=1);

namespace Tests\Feature\Charges;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use App\Modules\Rent\Enums\InstallmentStatus;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as RL;
use Tests\Feature\Rent\RentContext as R;

final class ExercisesContext
{
    /**
     * Bailleur autonome : un bien, un lot occupé par un bail signé du 2026-01-01 avec `$charges` de provision mensuelle, appels émis.
     *
     * @return array{org: Organization, owner: User, unit: Unit, property: string, lease: Lease, tenantParty: Party}
     */
    public static function scene(object $test, int $charges = 500, int $mois = 10): array
    {
        $org = R::organisation(OrganizationKind::Individual, 'Mme Martin');
        ['bail' => $bail, 'lot' => $lot, 'locataire' => $locataire] = R::bail($org, [], 65000, $charges);
        $scene = ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id, 'lease' => $bail, 'tenantParty' => $locataire];
        self::appeler($test, $org, $bail, $mois);

        return $scene;
    }

    /**
     * Émet l'appel de chacun des `$mois` premiers mois de 2026 (le 20 du mois précédent), puis revient à la date des tests.
     */
    public static function appeler(object $test, Organization $org, Lease $bail, int $mois): void
    {
        ChargesContext::comme($test, L::titulaire($org));

        for ($m = 1; $m <= $mois + 1; $m++) {
            $jour = CarbonImmutable::parse('2026-01-01')->addMonths($m - 1)->subDays(11);
            $test->travelTo($jour);
            R::generer($org, $bail, $jour->toDateString());

            foreach (R::echeances($org, $bail) as $echeance) {
                if ($echeance->status === InstallmentStatus::Upcoming) {
                    $test->postJson(R::url($org, "/installments/{$echeance->id}/issue"))->assertOk();
                }
            }
        }

        $test->travelTo(CarbonImmutable::parse(R::AUJOURDHUI));
    }

    /**
     * Bailleur autonome sans bail : un bien et un lot libre.
     *
     * @return array{org: Organization, owner: User, unit: Unit, property: string}
     */
    public static function sceneVide(): array
    {
        $org = R::organisation(OrganizationKind::Individual, 'Mme Martin');
        $lot = L::lot($org);

        return ['org' => $org, 'owner' => L::titulaire($org), 'unit' => $lot, 'property' => $lot->property_id];
    }

    public static function lot(Organization $org, string $property, int $surface = 5200): Unit
    {
        return L::dans($org, fn (): Unit => Unit::factory()->create([
            'property_id' => $property, 'surface_hundredths' => $surface, 'unit_type_term_id' => L::terme('unit_type', 'apartment')->id,
        ]));
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function cle(object $test, array $scene, string $genre, array $corps = []): TestResponse
    {
        return $test->postJson(ChargesContext::url($scene['org'], "/properties/{$scene['property']}/charge-keys"), ['label' => 'Clé '.$genre, 'kind' => $genre, 'valid_from' => '2020-01-01', ...$corps]);
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function exercice(object $test, array $scene, array $corps = []): TestResponse
    {
        return $test->postJson(ChargesContext::url($scene['org'], '/exercises'), ['property_id' => $scene['property'], 'period_start' => '2026-01-01', 'period_end' => '2026-11-01', ...$corps]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function poste(string $label, string $rubric, array $source, array $cible): array
    {
        return ['label' => $label, 'rubric' => $rubric, ...$cible, 'sources' => [$source]];
    }

    /**
     * Dépense récupérable du bien de la scène ; retourne son identifiant.
     *
     * @param  array<string, mixed>  $corps
     */
    public static function depense(object $test, array $scene, int $recuperable = 80000, array $corps = []): string
    {
        return ChargesContext::depense($test, $scene, ['recoverable_amount' => $recuperable, 'total_gross' => $recuperable + 16000, 'tax_amount' => 16000, ...$corps])->assertCreated()->json('data.id');
    }

    /**
     * Exercice 2026-01-01 → 2026-11-01 avec un poste unique sur la source donnée ; retourne l'identifiant de l'exercice.
     *
     * @param  array<string, mixed>  $cible  `key_id` ou `unit_id`, et `consumptions` éventuelles
     * @param  array<string, mixed>  $corps
     */
    public static function exerciceAvecPoste(object $test, array $scene, string $depense, int $montant, array $cible, array $corps = []): string
    {
        $poste = self::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => $montant], $cible);

        return self::exercice($test, $scene, ['items' => [$poste], ...$corps])->assertCreated()->json('data.id');
    }

    public static function calculer(object $test, array $scene, string $exercice): TestResponse
    {
        return $test->postJson(ChargesContext::url($scene['org'], "/exercises/{$exercice}/compute"));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function decomptes(Organization $org, string $exercice): array
    {
        return L::dans($org, fn (): array => array_map(fn (object $l): array => (array) $l, DB::table('charge_statements')->where('exercise_id', $exercice)->orderBy('id')->get()->all()));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function lignes(Organization $org, string $decompte): array
    {
        return L::dans($org, fn (): array => array_map(fn (object $l): array => (array) $l, DB::table('charge_statement_lines')->where('statement_id', $decompte)->orderBy('position')->get()->all()));
    }

    /**
     * Bail signé sur le lot donné, avec une provision (ou un forfait) de charges.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function bailSurLot(Organization $org, Unit $lot, array $attributs, string $charges = 'charges_provision'): Lease
    {
        $bail = RL::bailSigne($org, ['signed_on' => '2025-12-15', 'ends_on' => '2029-01-01', ...$attributs]);
        $debut = $bail->starts_on->toDateString();
        RL::occuper($org, $bail, $lot, ['valid_from' => $debut]);
        RL::lier($org, $bail, L::partie($org), ['valid_from' => $debut]);
        RL::terme($org, $bail, 'rent', ['amount' => Money::EUR(65000), 'valid_from' => $debut]);
        RL::terme($org, $bail, $charges, ['amount' => Money::EUR(500), 'valid_from' => $debut, 'indexed' => false]);

        return $bail;
    }

    /**
     * Scène autonome avec un exercice calculé à poste unique au lot : le décompte du bail vaut `$montant` moins 5 000 de provisions.
     *
     * @return array{scene: array<string, mixed>, exercice: string}
     */
    public static function calcule(object $test, int $montant = 3000, array $corpsDepense = []): array
    {
        $scene = self::scene($test);
        ChargesContext::comme($test, $scene['owner']);
        $depense = self::depense($test, $scene, max($montant, 1000), $corpsDepense);
        $exercice = self::exerciceAvecPoste($test, $scene, $depense, $montant, ['unit_id' => $scene['unit']->id]);
        self::calculer($test, $scene, $exercice)->assertOk();

        return ['scene' => $scene, 'exercice' => $exercice];
    }

    public static function emettre(object $test, array $scene, string $exercice, ?string $cle = null, array $corps = []): TestResponse
    {
        return $test->postJson(ChargesContext::url($scene['org'], "/exercises/{$exercice}/issue"), $corps, ['Idempotency-Key' => $cle ?? 'emi-'.bin2hex(random_bytes(6))]);
    }
}
