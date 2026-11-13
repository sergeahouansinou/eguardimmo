<?php

declare(strict_types=1);

use App\Providers\AppServiceProvider;
use App\Providers\HttpSecurityServiceProvider;
use App\Providers\ModuleServiceProvider;

return [
    AppServiceProvider::class,
    HttpSecurityServiceProvider::class,
    ModuleServiceProvider::class,
];
