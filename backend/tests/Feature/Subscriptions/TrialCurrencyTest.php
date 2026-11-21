<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Organizations\Support\OrganizationCurrency;
use App\Modules\Subscriptions\Actions\StartTrial;
use App\Modules\Subscriptions\Actions\VerifySubscriptions;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\Support\PlanGrid;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;

beforeEach(function (): void {
    app(PlanGrid::class)->seed();
    $this->devise = fn (Organization $organisation): string => AcrossOrganizations::query(Subscription::class)
        ->where('organization_id', $organisation->id)->firstOrFail()->currency;
});

it('ouvre l\'essai dans la devise du siège : EUR pour FR, BE et LU, CAD pour le Canada', function (string $pays, string $attendue): void {
    $organisation = Organization::factory()->create(['country' => $pays]);

    app(StartTrial::class)->handle($organisation->id);

    expect(($this->devise)($organisation))->toBe($attendue);
})->with([['FR', 'EUR'], ['BE', 'EUR'], ['LU', 'EUR'], ['CA', 'CAD']]);

it('suit toujours la devise exposée par Organizations pour le pays du siège', function (string $pays): void {
    $organisation = Organization::factory()->create(['country' => $pays]);

    app(StartTrial::class)->handle($organisation->id);

    $exposee = app(CurrentOrganization::class)->run($organisation->id, fn (): string => app(OrganizationDirectory::class)->currency()->getCode());
    expect(($this->devise)($organisation))->toBe($exposee)->toBe(OrganizationCurrency::of($pays)->getCode());
})->with(['FR', 'BE', 'LU', 'CA']);

it('ne reçoit aucun pays : l\'appelant ne peut pas imposer une devise différente de celle du siège', function (): void {
    expect((new ReflectionMethod(StartTrial::class, 'handle'))->getNumberOfParameters())->toBe(1);

    $organisation = Organization::factory()->create(['country' => 'CA']);
    app(StartTrial::class)->handle($organisation->id);

    expect(($this->devise)($organisation))->toBe('CAD');
});

it('ouvre l\'essai en CAD à la création d\'une organisation canadienne, par l\'événement', function (): void {
    $titulaire = User::factory()->create();

    $organisation = app(CreateOrganization::class)
        ->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence Québec', 'CA'), 'Awa', 'Diallo');

    expect(($this->devise)($organisation))->toBe('CAD');
});

it('rattrape les organisations sans abonnement dans la devise de leur siège', function (): void {
    $francaise = Organization::factory()->create(['country' => 'FR']);
    $canadienne = Organization::factory()->create(['country' => 'CA']);
    AcrossOrganizations::query(Subscription::class)->whereIn('organization_id', [$francaise->id, $canadienne->id])->delete();

    $bilan = app(VerifySubscriptions::class)->handle();

    expect($bilan['created'])->toBeGreaterThanOrEqual(2)
        ->and(($this->devise)($francaise))->toBe('EUR')
        ->and(($this->devise)($canadienne))->toBe('CAD');
});
