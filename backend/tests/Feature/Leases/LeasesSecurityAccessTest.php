<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeasesSecurityContext as X;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->lot = L::lot($this->org);
    $this->partie = L::partie($this->org);
    $this->bail = R::bailSigne($this->org);
    $this->routes = X::routes();
    $this->parcourir = function (string $contexte, int $statut, ?string $code, ?callable $avant = null): void {
        $echecs = [];

        foreach ($this->routes as $route) {
            $avant?->__invoke();
            X::constater($echecs, $contexte, $route, X::appeler($this, $route, $this->org, $this->bail->id, $this->lot, $this->partie), $statut, $code);
        }

        expect($echecs)->toBe([]);
    };
});

it('couvre toutes les routes leases.* du routeur', function (): void {
    expect(array_column($this->routes, 'name'))->toEqualCanonicalizing([
        'leases.index', 'leases.occupancy', 'leases.tenancies', 'leases.regimes', 'leases.show', 'leases.terms.index',
        'leases.store', 'leases.update', 'leases.duplicate', 'leases.sign', 'leases.cancel', 'leases.archive', 'leases.restore',
        'leases.terms.revise', 'leases.parties.store', 'leases.parties.end', 'leases.units.store', 'leases.units.end',
        'leases.notice', 'leases.terminate', 'leases.renew',
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
    $compte = L::membre($this->org, MemberRole::Owner);
    $this->withToken(X::jetonOperateur($compte));

    ($this->parcourir)('jeton opérateur', 403, 'operator_token_forbidden');
});

it('refuse à un compte dont l\'e-mail n\'est pas vérifié chaque route du module', function (): void {
    $compte = L::membre($this->org, MemberRole::Owner);
    activerDeuxFacteurs($compte);
    $compte->forceFill(['email_verified_at' => null])->save();
    $this->withToken($compte->createToken('t', ['mobile'])->plainTextToken);

    ($this->parcourir)('e-mail non vérifié', 403, 'email_unverified');
});

it('répond organization_not_found à un compte qui n\'est pas membre de l\'organisation, sur chaque route', function (): void {
    $etranger = L::titulaire(L::organisation());
    $this->actingAs($etranger);

    ($this->parcourir)('non membre', 404, 'organization_not_found');
});

it('répond organization_not_found à un membre désactivé ou seulement invité, sur chaque route', function (MemberStatus $statut): void {
    $compte = L::membre($this->org, MemberRole::Owner);
    activerDeuxFacteurs($compte);
    L::dans($this->org, fn () => OrganizationMember::query()->where('user_id', $compte->id)->update(['status' => $statut]));
    $this->actingAs($compte);

    ($this->parcourir)('membre '.$statut->value, 404, 'organization_not_found');
})->with([MemberStatus::Disabled, MemberStatus::Invited]);
