<?php

declare(strict_types=1);

$autres = ['Accounting', 'Catalog', 'Documents', 'Leases', 'Mandates', 'Parties', 'Properties', 'Rent', 'Invoicing', 'Recovery', 'Messaging', 'Reporting', 'Payments', 'Inspections', 'Maintenance', 'Planning', 'Notifications', 'Bookings'];

arch('Listings ne dépend que de Geography, d\'Organizations (nom public) et d\'Identity (compte)')
    ->expect('App\Modules\Listings')
    ->not->toUse(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", $autres));

arch('Geography ne dépend d\'aucun autre module')
    ->expect('App\Modules\Geography')
    ->not->toUse(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", [...$autres, 'Listings', 'Organizations', 'Identity']));

arch('les contrôleurs de Listings et Geography n\'accèdent pas à la base')
    ->expect(['App\Modules\Listings\Http\Controllers', 'App\Modules\Geography\Http\Controllers'])
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Listings\Models', 'App\Modules\Geography\Models']);

arch('les ressources publiques de Listings ne lisent ni la base ni un modèle')
    ->expect(['App\Modules\Listings\Http\Resources\ListingCardResource', 'App\Modules\Listings\Http\Resources\PublicListingResource', 'App\Modules\Listings\Http\Resources\ListingResource'])
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Listings\Models']);

arch('les actions de Listings et Geography sont finales et en lecture seule')
    ->expect('App\Modules\Listings\Actions')
    ->toBeFinal()->toBeReadonly();

arch('les événements de Listings partent après validation de la transaction')
    ->expect('App\Modules\Listings\Events')
    ->toImplement('Illuminate\Contracts\Events\ShouldDispatchAfterCommit');
