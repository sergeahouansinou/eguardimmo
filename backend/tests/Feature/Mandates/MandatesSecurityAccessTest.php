<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\OrganizationMember;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Mandates\MandatesSecurityContext as X;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->mandat = M::actif($this->org, $this->lot, $this->partie);
    $this->routes = X::routes();
    $this->parcourir = function (string $contexte, int $statut, ?string $code): void {
        $echecs = [];

        foreach ($this->routes as $route) {
            X::constater($echecs, $contexte, $route, X::appeler($this, $route, $this->org, $this->mandat->id, $this->lot, $this->partie), $statut, $code);
        }

        expect($echecs)->toBe([]);
    };
});

it('couvre toutes les routes mandates.* du routeur', function (): void {
    expect(array_column($this->routes, 'name'))->toEqualCanonicalizing([
        'mandates.index', 'mandates.mandants.index', 'mandates.show', 'mandates.end-request.show', 'mandates.end-request.dismiss',
        'mandates.store', 'mandates.update', 'mandates.activate', 'mandates.suspend', 'mandates.resume', 'mandates.terminate',
        'mandates.renew', 'mandates.terms.amend', 'mandates.archive', 'mandates.restore',
        'mandates.units.store', 'mandates.units.destroy', 'mandates.units.end',
        'mandates.documents.index', 'mandates.documents.store', 'mandates.documents.destroy',
    ]);
});

it('refuse sans jeton chaque route du module', function (): void {
    ($this->parcourir)('sans jeton', 401, null);
});

it('ne révèle pas l\'organisation à un compte sans profil d\'organisation, sur chaque route', function (): void {
    $compte = User::factory()->create();
    activerDeuxFacteurs($compte);
    $this->withToken($compte->createToken('t', ['mobile'])->plainTextToken);

    ($this->parcourir)('sans profil', 404, 'organization_not_found');
});

it('refuse à un jeton opérateur chaque route du module, même membre de l\'organisation', function (): void {
    $compte = M::membre($this->org, MemberRole::Owner);
    $this->withToken(X::jetonOperateur($compte));

    ($this->parcourir)('jeton opérateur', 403, 'operator_token_forbidden');
});

it('refuse à un compte dont l\'e-mail n\'est pas vérifié chaque route du module', function (): void {
    $compte = M::membre($this->org, MemberRole::Owner);
    $compte->forceFill(['email_verified_at' => null])->save();
    $this->withToken($compte->createToken('t', ['mobile'])->plainTextToken);

    ($this->parcourir)('e-mail non vérifié', 403, 'email_unverified');
});

it('répond organization_not_found à un compte qui n\'est pas membre de l\'organisation, sur chaque route', function (): void {
    $this->actingAs(M::titulaire(M::organisation()));

    ($this->parcourir)('non membre', 404, 'organization_not_found');
});

it('répond organization_not_found à un membre désactivé ou seulement invité, sur chaque route', function (MemberStatus $statut): void {
    $compte = M::membre($this->org, MemberRole::Owner);
    M::dans($this->org, fn () => OrganizationMember::query()->where('user_id', $compte->id)->update(['status' => $statut]));
    $this->actingAs($compte);

    ($this->parcourir)('membre '.$statut->value, 404, 'organization_not_found');
})->with([MemberStatus::Disabled, MemberStatus::Invited]);

it('refuse mandate_agency_only à une organisation de propriétaire autonome, sur chaque route', function (): void {
    $individuelle = M::organisation(OrganizationKind::Individual);
    $this->actingAs(M::titulaire($individuelle));
    $echecs = [];

    foreach ($this->routes as $route) {
        X::constater($echecs, 'organisation individuelle', $route, X::appeler($this, $route, $individuelle, $this->mandat->id, $this->lot, $this->partie), 403, 'mandate_agency_only');
    }

    expect($echecs)->toBe([]);
});
