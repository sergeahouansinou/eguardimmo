<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeasesSecurityContext as X;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->autre = L::organisation();
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->bail = R::bailSigne($this->org);
    $this->routes = X::routes(true);
    $this->parcourir = function (string $contexte, int $statut, ?string $code, ?string $bail = null): void {
        $echecs = [];

        foreach ($this->routes as $route) {
            X::constater($echecs, $contexte, $route, X::appeler($this, $route, $this->org, $bail ?? $this->bail->id, $this->lot, $this->partie), $statut, $code);
        }

        expect($echecs)->toBe([]);
    };
});

it('couvre toutes les routes de gestion des documents, de l\'assurance et des demandes de congé', function (): void {
    expect(array_column($this->routes, 'name'))->toEqualCanonicalizing([
        'leases.documents.index', 'leases.documents.store', 'leases.documents.destroy',
        'leases.insurance-submissions.index', 'leases.insurance-submissions.download', 'leases.insurance-submissions.accept', 'leases.insurance-submissions.reject',
        'leases.insurance.show', 'leases.insurance.reminder',
        'leases.notice-requests.index', 'leases.notice-requests.show', 'leases.notice-requests.proof', 'leases.notice-requests.acknowledge',
    ]);
});

it('refuse sans jeton chaque route', function (): void {
    ($this->parcourir)('sans jeton', 401, null);
});

it('répond organization_not_found à un compte non membre, sur chaque route', function (): void {
    $this->actingAs(L::titulaire($this->autre));

    ($this->parcourir)('non membre', 404, 'organization_not_found');
});

it('refuse à un jeton opérateur chaque route, même membre', function (): void {
    $this->withToken(X::jetonOperateur(L::membre($this->org, MemberRole::Owner)));

    ($this->parcourir)('jeton opérateur', 403, 'operator_token_forbidden');
});

it('refuse au comptable chaque route, lecture comprise', function (): void {
    $compte = L::membre($this->org, MemberRole::Accountant);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);

    ($this->parcourir)('comptable', 403, 'role_forbidden');
});

it('ne trouve ni le bail ni la ressource d\'une autre organisation, avec les trois rôles de gestion', function (MemberRole $role): void {
    $compte = $role === MemberRole::Owner ? L::titulaire($this->org) : L::membre($this->org, $role);
    activerDeuxFacteurs($compte);
    $this->actingAs($compte);
    $etranger = R::bailSigne($this->autre, ['reference' => 'BL-2026-0099']);
    $inconnu = (string) Str::uuid7();
    $echecs = [];

    foreach ($this->routes as $route) {
        $parametres = Route::getRoutes()->getByName($route['name'])?->parameterNames() ?? [];
        $reponse = X::appeler($this, $route, $this->org, in_array('lease', $parametres, true) ? $etranger->id : $inconnu, $this->lot, $this->partie);

        in_array('lease', $parametres, true) || in_array('submission', $parametres, true) || in_array('noticeRequest', $parametres, true)
            ? X::constater($echecs, $role->value, $route, $reponse, 404, null)
            : X::constater($echecs, $role->value, $route, $reponse, 200, null);
    }

    expect($echecs)->toBe([]);
})->with([MemberRole::Owner, MemberRole::Admin, MemberRole::Manager]);
