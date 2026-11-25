<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Mail;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as T;
use Tests\Feature\Properties\PropertiesContext as P;
use Tests\Feature\Subscriptions\QuotaContext as Q;

beforeEach(function (): void {
    Mail::fake();
    Q::demarrer();
    $this->org = Q::organisation();
    $this->titulaire = L::titulaire($this->org);
    Q::gratuit($this->org);
    $this->verrou = fn (array $trace, string $table): int|false => array_find_key($trace, fn (array $e): bool => $e[0] === T::LOCKED_READ && str_contains($e[1], "from \"{$table}\""));
});

it('verrouille l\'abonnement avant le site et le lot à la restauration d\'un lot', function (): void {
    $lot = P::lot($this->org, P::site($this->org));
    L::dans($this->org, fn () => $lot->forceFill(['archived_at' => now()])->save());

    $trace = T::run(fn () => Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "/units/{$lot->id}/archive"))->assertOk());

    $abonnement = ($this->verrou)($trace, 'subscriptions');
    $site = ($this->verrou)($trace, 'properties');
    $unite = ($this->verrou)($trace, 'units');

    expect($abonnement)->not->toBeFalse()->and($site)->not->toBeFalse()->and($unite)->not->toBeFalse()
        ->and($abonnement)->toBeLessThan($site)->and($abonnement)->toBeLessThan($unite);
});

it('refuse à la limite du plan avant de verrouiller le site et le lot', function (): void {
    $site = P::site($this->org);
    $archive = P::lot($this->org, $site);
    L::dans($this->org, fn () => $archive->forceFill(['archived_at' => now()])->save());
    P::lot($this->org, $site);

    $trace = T::run(fn () => Q::comme($this, $this->titulaire)->deleteJson(P::url($this->org, "/units/{$archive->id}/archive"))->assertStatus(409)->assertJsonPath('code', 'plan_quota_reached'));

    expect(array_filter($trace, fn (array $e): bool => $e[0] === T::LOCKED_READ && (str_contains($e[1], 'from "properties"') || str_contains($e[1], 'from "units"'))))->toBe([]);
});
