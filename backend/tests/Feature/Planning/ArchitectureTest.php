<?php

declare(strict_types=1);

$modules = ['Accounting', 'Catalog', 'Documents', 'Identity', 'Leases', 'Mandates', 'Organizations', 'Parties', 'Properties'];
$interdits = array_values(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", array_diff(
    ['Accounting', 'Catalog', 'Documents', 'Identity', 'Leases', 'Mandates', 'Organizations', 'Parties', 'Properties', 'Notifications', 'Rent', 'Invoicing', 'Recovery', 'Messaging', 'Reporting', 'Payments', 'Inspections', 'Marketplace', 'Maintenance'],
    ['Identity', 'Leases', 'Organizations', 'Parties', 'Properties'],
)));

arch('Planning ne dépend que de Identity (compte), Leases, Organizations, Parties et Properties, et jamais de Notifications')
    ->expect('App\Modules\Planning')
    ->not->toUse([...$interdits, 'App\Modules\Notifications']);

arch('les Actions de Planning sont des classes finales en lecture seule, une opération chacune')
    ->expect('App\Modules\Planning\Actions')
    ->toBeFinal()->toBeReadonly()->toHaveMethod('handle');

arch('les contrôleurs de Planning sont mono-action et sans accès direct à la base')
    ->expect('App\Modules\Planning\Http\Controllers')
    ->toBeFinal()->toHaveMethod('__invoke')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Planning\Models']);

arch('les événements de Planning sont émis après validation de la transaction')
    ->expect('App\Modules\Planning\Events')
    ->toImplement('Illuminate\Contracts\Events\ShouldDispatchAfterCommit');

arch('les DTO de Planning sont immuables et ne touchent pas aux modèles')
    ->expect('App\Modules\Planning\Data')
    ->toBeFinal()->toBeReadonly()->not->toUse('App\Modules\Planning\Models');

arch('les ressources de Planning ne lisent pas la base')
    ->expect('App\Modules\Planning\Http\Resources')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Planning\Models']);
