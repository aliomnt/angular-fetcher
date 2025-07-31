# Angular Fetcher

#### Signal-Based State Management for Remote API Data

angular-fetcher is a modern, signal-based library for managing remote API data in Angular applications. It offers a clean, reactive way to handle data fetching, mutations, and error tracking, all while keeping your code organized and type-safe. Built to work seamlessly with Angular's ecosystem, it empowers you to create responsive, robust apps with minimal effort. for managing remote API data in Angular applications. It offers a clean, reactive way to handle data fetching, mutations, and error tracking, all while keeping your code organized and type-safe. Built to work seamlessly with Angular's ecosystem, it empowers you to create responsive, robust apps with minimal effort.

## Table of Contents

- [Why Angular Fetcher?](#why-angular-fetcher)
- [Features](#features)
- [Angular Compatibility](#angular-compatibility)
- [Installation](#installation)
- [Fetching Data](#fetching-data)
- [Handling Mutations](#handling-mutations)
- [Empty Value Option](#empty-value-option)
- [Invalidate vs. Fetch](#invalidate-vs-fetch)
- [Abort Requests](#abort-requests)
- [Http Interceptor](#http-interceptor)
- [License](#license)

<br />

## Why Angular Fetcher?

angular-fetcher makes working with remote APIs in Angular a breeze. By leveraging Angular Signals and RxJS, it provides a powerful, type-safe API to manage data, loading states, and errors reactively. Whether you're fetching user lists or updating records with optimistic updates, this library ensures your app stays performant and maintainable, all with a syntax that feels natural in Angular.

<br />

## Features

- ✅ **Reactive Signals**: Track data, loading states, and errors in real-time using Angular Signals.
- ✅ **Data Fetching**: Load or refresh API data with full control over existing state.
- ✅ **Mutations**: Perform updates with optimistic changes and track specific mutation states using mutationLoadingKey.
- ✅ **Type Safety**: Enjoy TypeScript support for better code reliability and IDE assistance.
- ✅ **Angular Integration**: Works smoothly with Angular's dependency injection and RxJS.

<br />

## Angular Compatibility

| Angular Version | Supported Package Version |
| --------------- | ------------------------- |
| Angular `20.x`  | `^20.1.1`                 |
| Angular `19.x`  | `^19.0.2`                 |
| Angular `18.x`  | `^18.0.1`                 |
| Angular `17.x`  | `^17.0.1`                 |

> Please install the latest patch and minor version of each major release to ensure optimal compatibility.

<br />

## Installation

Add angular-fetcher to your project:

```bash
npm install angular-fetcher
```

<br />

## Fetching Data

Create a resource in your service to fetch data from an API using withResource. This sets up a reactive state for data, loading, and errors.

```ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { withResource } from "angular-fetcher";
import { Observable } from "rxjs";

interface User {
  id: number;
  name: string;
}

@Injectable({ providedIn: "root" })
export class UserService {
  private http = inject(HttpClient);

  usersResource = withResource(() => this.getUsers());

  private getUsers(): Observable<User[]> {
    return this.http.get<User[]>("/api/users");
  }
}
```

Use the resource in a component to display data and handle refreshes. The `invalidate()` method clears the current data and fetches fresh results.

```ts
import { Component } from "@angular/core";
import { UserService } from "./user.service";

@Component({
  selector: "app-user-list",
  template: `
    <button (click)="reload()">Reload Users</button>

    @if (users.state.fetchLoading()) {
    <div>Loading users...</div>
    } @else if (users.state.error()) {
    <div class="error">{{ users.state.error()?.message }}</div>
    } @else {
    <div class="user-list">
      @for (user of users.state.data(); track user.id) {
      <div>{{ user.name }}</div>
      }
    </div>
    }
  `,
  styles: [
    `
      .user-list {
        margin-top: 16px;
      }
      .error {
        color: red;
      }
    `,
  ],
})
export class UserListComponent {
  userService = inject(UserService);
  users = this.userService.usersResource;

  ngOnInit() {
    this.users.fetch(); // Load data initially
  }

  reload() {
    this.users.invalidate(); // Clear and refetch data
  }
}
```

You can also use the optional `handlers` argument with `fetch()` to respond to success or error states programmatically:

```ts
this.users.fetch({
  next: (res) => this.showToast("Users loaded: ", res),
  error: (err) => this.showToast(`Failed to load users: ${err.message}`),
});
```

<br />

## Handling Mutations

Use `withMutation` to perform operations like adding a user, with support for optimistic updates and tracking specific mutation states via `mutationLoadingKey`.

```ts
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { withResource } from "angular-fetcher";
import { Observable } from "rxjs";

interface User {
  id: number;
  name: string;
}

@Injectable({ providedIn: "root" })
export class UserService {
  private http = inject(HttpClient);

  usersResource = withResource(() => this.getUsers());

  private getUsers(): Observable<User[]> {
    return this.http.get<User[]>("/api/users");
  }

  addUser(user: User): Observable<User> {
    return this.http.post<User>("/api/users", user);
  }
}
```

In a component, trigger the mutation and show a success message using a `showToast` method.

```ts
import { Component } from "@angular/core";
import { UserService } from "./user.service";

@Component({
  selector: "app-add-user",
  template: `
    <input [(ngModel)]="newUser.name" placeholder="Enter name" />
    <button
      (click)="addUser()"
      [disabled]="users.state.mutationLoadingKey()['add-user']"
    >
      {{
        users.state.mutationLoadingKey()["add-user"] ? "Adding..." : "Add User"
      }}
    </button>
  `,
})
export class AddUserComponent {
  userService = inject(UserService);
  users = this.userService.usersResource;
  newUser: User = { id: 0, name: "" };

  addUser() {
    this.users.withMutation(this.userService.addUser(this.newUser), {
      key: "add-user",
      optimisticUpdate: (prev) => [...prev, this.newUser],
      invalidate: true, // Refetch users after mutation
      next: () => this.showToast("User added successfully!"),
      error: (err) => this.showToast(`Error: ${err.message}`),
    });
    this.newUser = { id: 0, name: "" };
  }

  private showToast(message: string) {
    console.log(message); // Replace with your toast service
  }
}
```

> Optimistic Update Explanation: Optimistic update is a technique where changes are applied immediately in the UI before receiving confirmation from the server. This improves perceived responsiveness by instantly reflecting user actions. If the server confirms the change, the update remains; if the request fails, the UI reverts to the previous state to maintain consistency.

<br/>

The `mutationLoadingKey()['add-user']` tracks the mutation's loading state, and `optimisticUpdate` instantly updates the UI while `invalidate: true` ensures the data syncs with the server.

<br />

## Empty Value Option

You can set an `emptyValue` in `withResource` to define the initial or reset state of the data. For example:

```ts
usersResource = withResource(() => this.getUsers(), {
  emptyValue: [] as User[],
});
```

This ensures the data starts as an empty array until fetched.

<br />

## Invalidate vs. Fetch

- `fetch()`: Loads data while keeping the current data until the new response arrives. Perfect for initial loads or refreshing without clearing the UI.
- `invalidate()`: Resets the data to its `emptyValue` (or empty object if not set) and fetches fresh results. Ideal for ensuring the latest server state, like after a mutation.

<br />

## Abort Requests

By default, if multiple requests are made to the same resource and a previous request has not yet completed, Angular Fetcher will automatically abort the previous request and only proceed with the latest one. This ensures your data is always fresh and consistent with the most recent interaction.

You can also abort a request manually using the `abort()` method if it hasn't completed yet:

```ts
this.usersResource.abort();
```

This is useful for cancelling background requests when navigating away from a view, or to reset state deliberately.

<br />

## Http Interceptor

Because angular-fetcher uses Angular’s HttpClient internally, it fully supports all features of Angular’s HTTP client, including interceptors. This means you can take advantage of authentication tokens, logging, error handling, and any custom request modifications seamlessly within angular-fetcher without additional setup.

<br/>

## License

MIT License | Ali Montazeri
