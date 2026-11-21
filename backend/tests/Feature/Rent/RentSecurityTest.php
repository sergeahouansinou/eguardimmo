<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->autre = C::organisation(nom: 'Autre Agence');
    ['bail' => $this->bail] = C::bail($this->org);
    ['bail' => $this->etranger] = C::bail($this->autre);
});

/**
 * Toutes les routes `rent.*` de l'espace organisation lues dans le routeur (celles de l'espace locataire : tests/Feature/Tenant ; le remboursement d'avance, aux rôles et au débit propres : RentRefundTest) : une route ajoutée plus tard entre d'elle-même dans les contrôles.
 *
 * @return list<array{name: string, method: string, write: bool}>
 */
function rentRoutes(): array
{
    $routes = [];

    foreach (Route::getRoutes()->getRoutes() as $route) {
        $nom = (string) $route->getName();

        if (str_starts_with($nom, 'rent.') && ! str_starts_with($nom, 'rent.tenant.') && $nom !== 'rent.leases.refunds.store') {
            $methode = strtolower(array_values(array_diff($route->methods(), ['HEAD']))[0]);
            $routes[] = ['name' => $nom, 'method' => $methode, 'write' => $methode !== 'get'];
        }
    }

    usort($routes, fn (array $a, array $b): int => $a['name'] <=> $b['name']);

    return $routes;
}

/**
 * @param  array{name: string, method: string, write: bool}  $route
 * @param  array<string, string>  $ids
 */
function rentUrl(array $route, object $org, array $ids): string
{
    $valeurs = ['organization' => $org->id, 'installment' => $ids['installment'], 'payment' => $ids['payment'], 'receipt' => $ids['receipt'], 'lease' => $ids['lease']];

    return route($route['name'], array_intersect_key($valeurs, array_flip(Route::getRoutes()->getByName($route['name'])?->parameterNames() ?? [])), false);
}

/**
 * @param  array{name: string, method: string, write: bool}  $route
 * @return array<string, mixed>
 */
function rentBody(array $route, string $bailId): array
{
    return match ($route['name']) {
        'rent.payments.store' => ['lease_id' => $bailId, 'amount' => 1000, 'method' => 'transfer', 'received_on' => '2026-11-16', 'idempotency_key' => 'cle-securite-1'],
        'rent.payments.cancel', 'rent.installments.cancel' => ['reason' => 'Test'],
        default => [],
    };
}

/**
 * @return array<string, string>
 */
function rentUnknownIds(): array
{
    return ['installment' => (string) Str::uuid7(), 'payment' => (string) Str::uuid7(), 'receipt' => (string) Str::uuid7(), 'lease' => (string) Str::uuid7()];
}

it('exige un jeton sur chaque route', function (): void {
    foreach (rentRoutes() as $route) {
        $this->json($route['method'], rentUrl($route, $this->org, rentUnknownIds()), rentBody($route, $this->bail->id))->assertUnauthorized();
    }

    expect(count(rentRoutes()))->toBe(17);
});

it('laisse au comptable toute la lecture et l\'enregistrement d\'un paiement, et lui refuse toute modification de l\'échéancier', function (): void {
    $this->actingAs(L::membre($this->org, MemberRole::Accountant));
    $ids = rentUnknownIds();

    foreach (rentRoutes() as $route) {
        $reponse = $this->json($route['method'], rentUrl($route, $this->org, $ids), rentBody($route, $this->bail->id));
        $autorise = ! $route['write'] || $route['name'] === 'rent.payments.store';

        $autorise
            ? expect($reponse->json('code'))->not->toBe('role_forbidden', $route['name'])
            : $reponse->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    expect(L::dans($this->org, fn () => Installment::query()->count()))->toBe(0);
});

it('le comptable enregistre un paiement mais ne peut pas l\'annuler', function (): void {
    C::emises($this->org, $this->bail, $this);
    R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));

    $id = C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/payments/{$id}/cancel"), ['reason' => 'Erreur'])->assertForbidden();
    expect(L::dans($this->org, fn () => Payment::query()->findOrFail($id)->status->value))->toBe('recorded');
});

it('laisse le propriétaire, l\'administrateur et le gestionnaire atteindre chaque écriture', function (MemberRole $role): void {
    $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);

    foreach (rentRoutes() as $route) {
        if ($route['write']) {
            $reponse = $this->json($route['method'], rentUrl($route, $this->org, rentUnknownIds()), rentBody($route, rentUnknownIds()['lease']));

            expect($reponse->getStatusCode())->not->toBe(403, $route['name'])->not->toBe(401, $route['name']);
        }
    }
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);

it('ne montre rien d\'une autre organisation : 404 sur chaque route qui désigne une ressource, rien de modifié', function (): void {
    [$echeance] = C::emises($this->autre, $this->etranger, $this);
    $paiement = C::payer($this, $this->autre, $this->etranger, 30000)->assertCreated()->json('data.id');
    C::payer($this, $this->autre, $this->etranger, 40000)->assertCreated();
    $quittance = L::dans($this->autre, fn () => RentReceipt::query()->firstOrFail()->id);
    $ids = ['installment' => $echeance->id, 'payment' => $paiement, 'receipt' => $quittance, 'lease' => $this->etranger->id];
    $avant = [L::dans($this->autre, fn () => Installment::query()->count()), L::dans($this->autre, fn () => Payment::query()->count()), C::du($this->autre, $this->etranger)];
    R::changerDeCompte($this, L::titulaire($this->org));
    $verifiees = 0;

    foreach (rentRoutes() as $route) {
        $url = rentUrl($route, $this->org, $ids);

        if (! preg_match('#/(installments|payments|receipts|leases)/[0-9a-f-]{36}#', $url)) {
            continue;
        }

        $verifiees++;
        $reponse = $this->json($route['method'], $url, rentBody($route, $this->etranger->id));

        expect($reponse->getStatusCode())->toBe(404, $route['name'])
            ->and($reponse->json('code'))->toBeIn(['rent_installment_not_found', 'rent_payment_not_found', 'rent_receipt_not_found', 'lease_not_found'], $route['name']);
    }

    $this->postJson(C::url($this->org, '/payments'), rentBody(['name' => 'rent.payments.store', 'method' => 'post', 'write' => true], $this->etranger->id))
        ->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    expect($verifiees)->toBe(11)
        ->and([L::dans($this->autre, fn () => Installment::query()->count()), L::dans($this->autre, fn () => Payment::query()->count()), C::du($this->autre, $this->etranger)])->toBe($avant);
});

it('une liste ne renvoie jamais les lignes d\'une autre organisation, même filtrée sur leur bail', function (): void {
    [$echeance] = C::emises($this->autre, $this->etranger, $this);
    C::payer($this, $this->autre, $this->etranger, 70000)->assertCreated();
    R::changerDeCompte($this, L::titulaire($this->org));

    foreach (['/installments', '/payments', '/receipts'] as $chemin) {
        $this->getJson(C::url($this->org, $chemin.'?lease='.$this->etranger->id))->assertOk()->assertJsonCount(0, 'data');
    }

    $this->getJson(C::url($this->org, '/installments/'.$echeance->id))->assertNotFound();
});

it('refuse un compte qui n\'appartient pas à l\'organisation', function (): void {
    $this->actingAs(L::titulaire($this->autre));

    foreach (rentRoutes() as $route) {
        $this->json($route['method'], rentUrl($route, $this->org, rentUnknownIds()), rentBody($route, $this->bail->id))
            ->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('refuse un identifiant qui n\'est pas un uuid', function (): void {
    $this->actingAs(L::titulaire($this->org));

    $this->getJson(C::url($this->org, '/installments/pas-un-uuid'))->assertNotFound();
    $this->getJson(C::url($this->org, '/payments/12345'))->assertNotFound();
    $this->postJson(C::url($this->org, '/leases/xyz/installments/generate'))->assertNotFound();
});

it('limite le débit de chaque écriture à 60 appels par minute', function (): void {
    $this->actingAs(L::titulaire($this->org));
    $echecs = [];

    foreach (rentRoutes() as $route) {
        if (! $route['write']) {
            continue;
        }

        Cache::flush();
        $url = rentUrl($route, $this->org, rentUnknownIds());
        $trop = 0;

        foreach (range(1, 60) as $i) {
            $trop += $this->json($route['method'], $url, rentBody($route, $this->bail->id))->getStatusCode() === 429 ? 1 : 0;
        }

        if ($trop !== 0 || $this->json($route['method'], $url, rentBody($route, $this->bail->id))->getStatusCode() !== 429) {
            $echecs[] = $route['name'];
        }
    }

    expect($echecs)->toBe([]);
});
